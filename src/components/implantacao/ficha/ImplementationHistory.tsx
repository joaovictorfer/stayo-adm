import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../../ui/button";
import { auditToEntry, mergeHistory, type AuditRow, type HistoryEntry } from "../../../lib/implementation-history";

const LIMIT = 10;
const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

/** Linha do tempo única: une propostas, auditoria, etapas, atualizações e decisões, sem duplicar. */
export function ImplementationHistory({ implementationId, proposalIds, base }: { implementationId: string; proposalIds: string[]; base: HistoryEntry[] }) {
  const [all, setAll] = useState(false);
  const q = useQuery({
    queryKey: ["implementation-history", implementationId, proposalIds.join(",")],
    queryFn: async () => {
      const ids = [implementationId, ...proposalIds].join(",");
      const [audit, steps, updates, decisions] = await Promise.all([
        supabase.from("audit_logs").select("id,event,entity_id,actor_id,metadata,created_at")
          .or(`entity_id.in.(${ids}),metadata->>implementationId.eq.${implementationId}`).order("created_at", { ascending: false }).limit(300),
        supabase.from("implementation_timeline_steps").select("id,title,done_at").eq("implementation_id", implementationId).not("done_at", "is", null),
        supabase.from("implementation_timeline_updates").select("id,title,description,event_date,created_at,created_by").eq("implementation_id", implementationId),
        supabase.from("implementation_field_confirmations").select("id,field_key,note,updated_at,updated_by").eq("implementation_id", implementationId).like("field_key", "div:%"),
      ]);
      const actorIds = new Set<string>();
      (audit.data ?? []).forEach((r) => r.actor_id && actorIds.add(r.actor_id));
      (updates.data ?? []).forEach((r) => r.created_by && actorIds.add(r.created_by));
      (decisions.data ?? []).forEach((r) => r.updated_by && actorIds.add(r.updated_by));
      const profiles = actorIds.size ? await supabase.from("admin_profiles").select("id,full_name").in("id", [...actorIds]) : { data: [] };
      const names = Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p.full_name ?? "Equipe STAYO"]));
      const who = (id: string | null) => (id ? names[id] ?? "Equipe STAYO" : null);
      return mergeHistory(
        (audit.data ?? []).map((r) => auditToEntry(r as AuditRow, names)),
        (steps.data ?? []).map((s) => ({ id: `step-${s.id}`, label: `Etapa concluída: ${s.title}`, timestamp: s.done_at as string })),
        (updates.data ?? []).map((u) => ({ id: `upd-${u.id}`, label: u.title, detail: u.description, timestamp: (u.event_date ?? u.created_at) as string, actor: who(u.created_by) })),
        (decisions.data ?? []).map((d) => ({ id: `dec-${d.id}`, label: d.note === "conferir_local" ? "Divergência marcada para conferir" : "Divergência revisada: mantido o oficial", detail: d.field_key.slice(4), timestamp: d.updated_at, actor: who(d.updated_by) })),
      );
    },
  });
  const entries = mergeHistory(q.data ?? [], base);
  const shown = all ? entries : entries.slice(0, LIMIT);
  return (
    <section className="rounded-[var(--radius-card)] border bg-white p-4 sm:p-5" style={{ borderColor: "var(--stayo-border)" }}>
      <h2 className="mb-3 font-[Outfit] text-lg font-semibold text-[var(--stayo-navy)]">Histórico</h2>
      {q.isLoading && !entries.length ? <p className="text-sm text-[var(--stayo-ink-muted)]">Carregando…</p> : !entries.length ? <p className="text-sm text-[var(--stayo-ink-muted)]">Nenhuma atividade registrada ainda.</p> : (
        <ol className="relative ml-1 border-l border-[var(--stayo-border)]">
          {shown.map((e) => (
            <li key={e.id} className="relative pb-3 pl-4 last:pb-0">
              <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-[var(--stayo-navy)]" aria-hidden />
              <p className="text-sm font-medium text-[var(--stayo-navy)]">{e.label}</p>
              {e.detail && <p className="text-xs text-[var(--stayo-ink-muted)]">{e.detail}</p>}
              <p className="text-xs text-[var(--stayo-ink-muted)]">{fmt(e.timestamp)}{e.actor ? ` · ${e.actor}` : ""}</p>
            </li>
          ))}
        </ol>
      )}
      {entries.length > LIMIT && <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => setAll((v) => !v)}>{all ? "Mostrar menos" : `Ver tudo (${entries.length})`}</Button>}
    </section>
  );
}
