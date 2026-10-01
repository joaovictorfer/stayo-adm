import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { StayoLogo } from "@/components/brand/StayoLogo";
import { Button } from "../components/ui/button";
import { useOwnerSession } from "../lib/auth/owner-session";
import {
  inventoryAnswerLabel,
  inventoryConditionLabel,
  inventoryRooms,
  type InventoryAnswer,
  type InventoryCondition,
  type InventoryRoom,
} from "../lib/guided-inventory";
import {
  ownerInventoryQuery,
  ownerSubmitInventory,
  type OwnerInventoryItem,
  type OwnerProposal,
  type OwnerSubmission,
} from "../lib/api/owner-inventory";

export const Route = createFileRoute("/portal/inventario/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inventário do imóvel — Portal do Proprietário Stayo" },
      { name: "description", content: "Informe o que já existe em cada ambiente do seu imóvel." },
      { property: "og:title", content: "Inventário do imóvel — Portal do Proprietário Stayo" },
      { property: "og:description", content: "Informe o que já existe em cada ambiente do seu imóvel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerInventoryPage,
});

const muted = { color: "var(--stayo-ink-muted)" };
const border = { borderColor: "var(--stayo-border)" };
const on = { backgroundColor: "var(--stayo-primary, #0b3150)", color: "var(--stayo-on-primary, #fff)", borderColor: "transparent" };
const ANSWERS: InventoryAnswer[] = ["tenho", "nao_tenho", "nao_aplica"];
const CONDS: InventoryCondition[] = ["bom", "atencao", "danificado"];

function OwnerInventoryPage() {
  const { id } = Route.useParams();
  const auth = useOwnerSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (auth.status === "unauthenticated" || auth.status === "not_required") void navigate({ to: "/portal/login" });
  }, [auth.status, navigate]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-xl px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <Link to="/portal/inicio" className="flex items-center gap-1 text-sm"><ArrowLeft className="h-4 w-4" /> Início</Link>
        <StayoLogo className="h-7" />
      </header>
      {auth.status === "authenticated" ? (
        <Inventory implementationId={id} />
      ) : auth.status === "unlinked" || auth.status === "error" ? (
        <p className="rounded-lg border p-4 text-sm" style={border} role="alert">{auth.message ?? "Sem acesso."}</p>
      ) : (
        <p className="flex items-center gap-2 text-sm" style={muted}><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      )}
    </div>
  );
}

function Inventory({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const query = ownerInventoryQuery(implementationId);
  const q = useQuery(query);
  const [room, setRoom] = useState<InventoryRoom | null>(null);
  const [open, setOpen] = useState<string | "novo" | null>(null);
  const [notice, setNotice] = useState<"ok" | "erro" | null>(null);

  const send = useMutation({
    mutationFn: (v: { itemId: string | null; p: OwnerProposal }) => ownerSubmitInventory(implementationId, v.itemId, v.p),
    onSuccess: async () => { setNotice("ok"); setOpen(null); await qc.invalidateQueries({ queryKey: query.queryKey }); },
    onError: () => setNotice("erro"),
  });

  if (q.isPending) return <p className="flex items-center gap-2 text-sm" style={muted} role="status"><Loader2 className="h-4 w-4 animate-spin" /> Carregando inventário…</p>;
  if (q.isError) {
    const denied = /acesso|42501|permiss/i.test(String((q.error as Error)?.message));
    return (
      <div className="space-y-2 rounded-lg border p-4 text-sm" style={border} role="alert">
        <p className="font-medium">{denied ? "Você não tem acesso a este imóvel" : "Não foi possível abrir o inventário"}</p>
        {!denied && <Button size="sm" variant="outline" onClick={() => void q.refetch()}><RotateCcw className="mr-1 h-4 w-4" /> Tentar de novo</Button>}
      </div>
    );
  }

  const { implementation, items, submissions } = q.data;
  const subFor = (itemId: string) => submissions.find((s) => s.itemId === itemId);
  const idx = room ? inventoryRooms.findIndex((r) => r.key === room) : -1;
  const roomItems = items.filter((i) => i.room === room);
  const newOnes = submissions.filter((s) => s.kind === "novo_item" && s.proposed.room === room);
  const informed = (i: OwnerInventoryItem) => Boolean(i.answer || subFor(i.id)?.proposed.answer);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">Inventário do imóvel</h1>
        <p className="text-xs" style={muted}>{[implementation.nickname ?? implementation.code, implementation.condominiumName, implementation.unit].filter(Boolean).join(" · ")}</p>
      </div>
      {notice === "ok" && <p className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm" style={border} role="status"><Check className="h-4 w-4" /> Informação enviada para revisão da STAYO</p>}
      {notice === "erro" && <p className="rounded-lg border px-3 py-2 text-sm" style={{ ...border, color: "var(--stayo-danger, #b42318)" }} role="alert">Não foi possível enviar. Tente de novo.</p>}

      {!room ? (
        <div className="grid gap-2">
          {inventoryRooms.map((r) => {
            const list = items.filter((i) => i.room === r.key);
            return (
              <button key={r.key} onClick={() => { setRoom(r.key); setNotice(null); }} className="flex min-h-14 items-center justify-between rounded-xl border px-4 text-left" style={border}>
                <span><b className="block text-sm">{r.label}</b><small style={muted}>{list.length ? `${list.filter(informed).length} de ${list.length} informados` : "Sem itens"}</small></span>
                <ChevronRight className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-1 text-sm" onClick={() => setRoom(null)}><ArrowLeft className="h-4 w-4" /> Ambientes</button>
            <b className="text-sm">{inventoryRooms[idx]?.label}</b>
            <span className="flex">
              <Button size="icon" variant="ghost" aria-label="Ambiente anterior" disabled={idx <= 0} onClick={() => setRoom(inventoryRooms[idx - 1]!.key)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Próximo ambiente" disabled={idx >= inventoryRooms.length - 1} onClick={() => setRoom(inventoryRooms[idx + 1]!.key)}><ChevronRight className="h-4 w-4" /></Button>
            </span>
          </div>
          {roomItems.length === 0 && newOnes.length === 0 && <p className="rounded-lg border p-3 text-sm" style={{ ...border, ...muted }}>Nenhum item neste ambiente ainda.</p>}
          <ul className="space-y-2">
            {roomItems.map((i) => {
              const s = subFor(i.id);
              const current = s?.proposed.answer ?? i.answer;
              return (
                <li key={i.id} className="rounded-xl border p-3" style={border} data-testid="owner-inventory-row">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{i.name}</span>
                    <Status item={i} sub={s} />
                  </div>
                  {s?.status === "complemento_solicitado" && s.ownerMessage && <p className="mt-1 text-xs">STAYO pediu: {s.ownerMessage}</p>}
                  <div className="mt-2 grid grid-cols-3 gap-1" role="radiogroup" aria-label={`Resposta para ${i.name}`}>
                    {ANSWERS.map((a) => (
                      <button key={a} role="radio" aria-checked={current === a} disabled={send.isPending}
                        onClick={() => send.mutate({ itemId: i.id, p: { ...(s?.proposed ?? {}), answer: a } })}
                        className="min-h-10 rounded-lg border text-xs" style={current === a ? on : border}>{inventoryAnswerLabel[a]}</button>
                    ))}
                  </div>
                  <button className="mt-1 text-xs underline" style={muted} onClick={() => setOpen(open === i.id ? null : i.id)}>Detalhes</button>
                  {open === i.id && <DetailsForm initial={{ ...(s?.proposed ?? {}), answer: current ?? undefined }} busy={send.isPending} onSubmit={(p) => send.mutate({ itemId: i.id, p })} />}
                </li>
              );
            })}
            {newOnes.map((s) => (
              <li key={s.id} className="rounded-xl border p-3 text-sm" style={border}>
                <span className="font-medium">{s.proposed.name}</span>
                <span className="ml-2 text-[11px]" style={muted}>Informado por você · {s.status === "complemento_solicitado" ? "STAYO pediu complemento" : "em revisão"}</span>
                {s.ownerMessage && <p className="mt-1 text-xs">STAYO pediu: {s.ownerMessage}</p>}
              </li>
            ))}
          </ul>
          {open === "novo" ? (
            <div className="rounded-xl border p-3" style={border}>
              <DetailsForm withName initial={{ answer: "tenho" }} busy={send.isPending} onSubmit={(p) => send.mutate({ itemId: null, p: { ...p, room: room ?? undefined } })} />
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setOpen("novo")}><Plus className="mr-1 h-4 w-4" /> Adicionar item</Button>
          )}
        </div>
      )}
    </div>
  );
}

function Status({ item, sub }: { item: OwnerInventoryItem; sub?: OwnerSubmission | undefined }) {
  const label = sub ? (sub.status === "complemento_solicitado" ? "Complemento pedido" : "Em revisão") : item.reviewStatus === "revisado_stayo" ? "Revisado pela STAYO" : item.answer ? "Preenchido pela STAYO" : "Não informado";
  return <span className="shrink-0 text-[11px]" style={muted}>{label}</span>;
}

function DetailsForm({ initial, onSubmit, busy, withName }: { initial: OwnerProposal; onSubmit: (p: OwnerProposal) => void; busy: boolean; withName?: boolean | undefined }) {
  const [p, setP] = useState<OwnerProposal>(initial);
  const field = "h-10 w-full rounded-lg border px-3 text-sm";
  return (
    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); onSubmit(Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "" && v != null)) as OwnerProposal); }}>
      {withName && <input required className={field} style={border} maxLength={120} placeholder="Nome do item" aria-label="Nome do item" value={p.name ?? ""} onChange={(e) => setP({ ...p, name: e.target.value })} />}
      <div className="grid grid-cols-2 gap-2">
        <input className={field} style={border} inputMode="numeric" placeholder="Quantidade" aria-label="Quantidade" value={p.quantity ?? ""} onChange={(e) => setP({ ...p, quantity: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })} />
        <input className={field} style={border} maxLength={80} placeholder="Marca" aria-label="Marca" value={p.brand ?? ""} onChange={(e) => setP({ ...p, brand: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Estado">
        {CONDS.map((c) => (
          <button type="button" key={c} role="radio" aria-checked={p.condition === c} className="min-h-10 rounded-lg border text-xs" style={p.condition === c ? on : border}
            onClick={() => setP({ ...p, condition: p.condition === c ? undefined : c })}>{inventoryConditionLabel[c]}</button>
        ))}
      </div>
      <textarea className="min-h-16 w-full rounded-lg border p-2 text-sm" style={border} maxLength={500} placeholder="Observação (opcional)" aria-label="Observação" value={p.note ?? ""} onChange={(e) => setP({ ...p, note: e.target.value })} />
      <Button type="submit" size="sm" disabled={busy || (withName && !p.name?.trim())}>Enviar para revisão</Button>
    </form>
  );
}
