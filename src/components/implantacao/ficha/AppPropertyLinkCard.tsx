import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Link2, Search } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { appLinkAvailability, linkAppProperty, searchAppProperties } from "../../../lib/stayo-central/property-link.functions";
import { compareProperty, type AppPropertyCandidate } from "../../../lib/stayo-central/property-link";
import type { ImplementationProject } from "../../../types/core";

const MSG: Record<string, string> = {
  forbidden: "Você não tem permissão para consultar o STAYO APP.",
  not_configured: "Integração com o STAYO APP ainda não configurada.",
  connection_disabled: "A busca será liberada quando a conexão com o STAYO APP for homologada.",
  linked_elsewhere: "Esta unidade já está vinculada a outra ficha. Vínculo bloqueado.",
  needs_ack: "Os dados são diferentes. Confirme que é o mesmo imóvel.",
  same_already: "Esta ficha já está vinculada a esse imóvel.",
};
const failMsg = (k: string) => MSG[k] ?? "Não foi possível consultar o STAYO APP agora. Tente novamente em instantes.";

export function AppPropertyLinkCard({ implementation }: { implementation: ImplementationProject }) {
  const qc = useQueryClient();
  const availFn = useServerFn(appLinkAvailability);
  const searchFn = useServerFn(searchAppProperties);
  const linkFn = useServerFn(linkAppProperty);
  const avail = useQuery({ queryKey: ["app-link-availability"], queryFn: () => availFn(), staleTime: 60_000, enabled: !implementation.corePropertyId });
  const [query, setQuery] = useState(`${implementation.condominiumName ?? ""} ${implementation.unit ?? ""}`.trim());
  const [state, setState] = useState<{ phase: "idle" | "searching" | "results" | "error"; items: AppPropertyCandidate[]; error?: string }>({ phase: "idle", items: [] });
  const [picked, setPicked] = useState<AppPropertyCandidate | null>(null);
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const box = "rounded-[var(--radius-card)] border bg-white p-4 sm:p-5";
  const border = { borderColor: "var(--stayo-border)" };

  if (implementation.corePropertyId) {
    return (
      <section className={box} style={border}>
        <p className="flex items-center gap-2 font-semibold text-[var(--stayo-navy)]"><CheckCircle2 className="size-5" /> Vinculado ao APP</p>
        <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">Identificador no STAYO APP: {implementation.corePropertyId.slice(0, 8)}…</p>
      </section>
    );
  }

  const enabled = avail.data?.enabled === true;
  const search = async () => {
    setPicked(null); setState({ phase: "searching", items: [] });
    try {
      const r = await searchFn({ data: { implementationId: implementation.id, query } });
      setState(r.ok ? { phase: "results", items: r.items } : { phase: "error", items: [], error: failMsg(r.kind) });
    } catch { setState({ phase: "error", items: [], error: failMsg("unavailable") }); }
  };
  const rows = picked ? compareProperty({ condominium: implementation.condominiumName, unit: implementation.unit, address: implementation.address }, picked) : [];
  const diffs = rows.filter((r) => r.differs).length;
  const confirm = async () => {
    if (!picked) return;
    setSaving(true); setLinkError(null);
    try {
      const r = await linkFn({ data: { implementationId: implementation.id, corePropertyId: picked.id, acknowledged: ack } });
      if (!r.ok) setLinkError(failMsg(r.kind));
      else await qc.invalidateQueries();
    } catch { setLinkError(failMsg("unavailable")); } finally { setSaving(false); }
  };

  return (
    <section className={box} style={border}>
      <h3 className="flex items-center gap-2 font-[Outfit] text-lg font-semibold text-[var(--stayo-navy)]"><Link2 className="size-5" /> Vincular imóvel do STAYO APP</h3>
      <p className="mt-1 text-sm text-[var(--stayo-ink-muted)]">Obrigatório antes de marcar a ficha como Ativo.</p>
      {avail.isLoading ? <p className="mt-3 text-sm text-[var(--stayo-ink-muted)]">Verificando conexão…</p> : !enabled ? (
        <p className="mt-3 rounded-lg bg-[var(--stayo-surface-muted,#f3f5f8)] p-3 text-sm">{failMsg(avail.data?.kind ?? "unavailable")}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Condomínio, unidade ou código" className="h-11" />
            <Button type="submit" className="h-11" disabled={query.trim().length < 2 || state.phase === "searching"}><Search className="size-4" /> Buscar</Button>
          </form>
          {state.phase === "error" && <p className="text-sm text-[var(--stayo-danger,#b42318)]">{state.error}</p>}
          {state.phase === "results" && !state.items.length && <p className="text-sm text-[var(--stayo-ink-muted)]">Nenhum imóvel encontrado no STAYO APP com essa busca.</p>}
          {state.phase === "results" && state.items.map((c) => (
            <button key={c.id} type="button" onClick={() => { setPicked(c); setAck(false); setLinkError(null); }}
              className="rounded-lg border p-3 text-left" style={{ borderColor: picked?.id === c.id ? "var(--stayo-navy)" : "var(--stayo-border)" }}>
              <p className="font-medium">{c.name ?? "Sem nome"} {c.code ? `· ${c.code}` : ""}</p>
              <p className="text-xs text-[var(--stayo-ink-muted)]">{[c.address, c.city].filter(Boolean).join(" · ")}</p>
              {c.linkedToCode && <p className="mt-1 text-xs font-medium text-[var(--stayo-danger,#b42318)]">Já vinculado à ficha {c.linkedToCode}</p>}
            </button>
          ))}
          {picked && (
            <div className="rounded-lg border p-3" style={border}>
              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm">
                <span /><span className="text-xs font-semibold">Ficha</span><span className="text-xs font-semibold">STAYO APP</span>
                {rows.map((r) => (
                  <div key={r.key} className="contents">
                    <span className="text-xs text-[var(--stayo-ink-muted)]">{r.label}</span>
                    <span className={r.differs ? "font-medium text-[var(--stayo-danger,#b42318)]" : ""}>{r.local ?? "—"}</span>
                    <span className={r.differs ? "font-medium text-[var(--stayo-danger,#b42318)]" : ""}>{r.app ?? "—"}</span>
                  </div>
                ))}
              </div>
              {picked.linkedToCode ? <p className="mt-3 text-sm text-[var(--stayo-danger,#b42318)]">{MSG.linked_elsewhere}</p> : (
                <>
                  {diffs > 0 && (
                    <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1" /> Os dados são diferentes, mas confirmo que é o mesmo imóvel.</label>
                  )}
                  <Button className="mt-3 h-11 w-full" disabled={saving || (diffs > 0 && !ack)} onClick={() => void confirm()}>{saving ? "Vinculando…" : "Confirmar vínculo"}</Button>
                </>
              )}
              {linkError && <p className="mt-2 text-sm text-[var(--stayo-danger,#b42318)]">{linkError}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
