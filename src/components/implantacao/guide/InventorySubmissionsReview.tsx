import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "../../ui/button";
import {
  inventorySubmissionsQuery,
  reviewInventorySubmission,
  type InventorySubmissionRow,
  type OwnerProposal,
  type ReviewDecision,
} from "../../../lib/api/owner-inventory";
import { inventoryAnswerLabel, inventoryConditionLabel, inventoryRooms, type InventorySnapshotItem } from "../../../lib/guided-inventory";

const muted = { color: "var(--stayo-ink-muted)" };
const border = { borderColor: "var(--stayo-border)" };
const field = "h-9 rounded-md border px-2 text-sm";

function describe(v: Record<string, unknown> | null | undefined) {
  if (!v) return "—";
  const parts = [
    v["name"] as string | undefined,
    v["answer"] ? inventoryAnswerLabel[v["answer"] as keyof typeof inventoryAnswerLabel] : null,
    v["quantity"] != null ? `${v["quantity"]} un.` : null,
    v["brand"] as string | undefined,
    v["condition"] ? inventoryConditionLabel[v["condition"] as keyof typeof inventoryConditionLabel] : null,
    v["note"] ? `"${v["note"]}"` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Não informado";
}

/** Envios do proprietário aguardando decisão da STAYO. Nada vira verdade sem esta revisão. */
export function InventorySubmissionsReview({ implementationId, items }: { implementationId: string; items: InventorySnapshotItem[] }) {
  const qc = useQueryClient();
  const q = useQuery(inventorySubmissionsQuery(implementationId));
  const pending = (q.data ?? []).filter((s) => s.status === "enviado");
  if (q.isError) return <p className="text-xs" role="alert" style={muted}>Não foi possível carregar os envios do proprietário.</p>;
  if (!pending.length) return null;
  return (
    <section className="space-y-2 rounded-lg border p-3" style={border} aria-label="Envios do proprietário">
      <b className="text-sm">Informado pelo proprietário · {pending.length} para revisar</b>
      {pending.map((s) => (
        <Row key={s.id} s={s} item={items.find((i) => i.id === s.item_id)} onDone={async () => {
          await qc.invalidateQueries({ queryKey: ["guided-inventory-submissions", implementationId] });
          await qc.invalidateQueries({ queryKey: ["guided-inventory", implementationId] });
        }} />
      ))}
    </section>
  );
}

function Row({ s, item, onDone }: { s: InventorySubmissionRow; item?: InventorySnapshotItem | undefined; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<null | "ajustar" | "complemento">(null);
  const [vals, setVals] = useState<OwnerProposal>(s.proposed);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: (d: ReviewDecision) => reviewInventorySubmission(s.id, d),
    onSuccess: onDone,
  });
  const name = item?.name ?? s.proposed.name ?? "Item";
  const room = inventoryRooms.find((r) => r.key === (item?.room ?? s.proposed.room))?.label;
  const internal = note.trim() || undefined;
  return (
    <div className="space-y-1 rounded-md border p-2 text-sm" style={border} data-testid="inventory-submission">
      <p><b>{name}</b> <span className="text-[11px]" style={muted}>{room} · {s.kind === "novo_item" ? "item novo" : "alteração"} · {new Date(s.updated_at).toLocaleString("pt-BR")}</span></p>
      {s.kind === "item" && <p className="text-xs" style={muted}>Antes: {describe(s.previous)}</p>}
      <p className="text-xs">Proposto: {describe(s.proposed as Record<string, unknown>)}</p>

      {mode === "ajustar" && (
        <div className="flex flex-wrap gap-2">
          <select className={field} style={border} aria-label="Resposta ajustada" value={vals.answer ?? ""} onChange={(e) => setVals({ ...vals, answer: (e.target.value || undefined) as OwnerProposal["answer"] })}>
            <option value="">Não informado</option>
            {Object.entries(inventoryAnswerLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className={`${field} w-20`} style={border} aria-label="Quantidade ajustada" inputMode="numeric" value={vals.quantity ?? ""} onChange={(e) => setVals({ ...vals, quantity: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })} />
          <input className={`${field} w-32`} style={border} aria-label="Marca ajustada" value={vals.brand ?? ""} onChange={(e) => setVals({ ...vals, brand: e.target.value })} />
          <select className={field} style={border} aria-label="Estado ajustado" value={vals.condition ?? ""} onChange={(e) => setVals({ ...vals, condition: (e.target.value || undefined) as OwnerProposal["condition"] })}>
            <option value="">Sem estado</option>
            {Object.entries(inventoryConditionLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      )}
      {mode === "complemento" && (
        <input className={`${field} w-full`} style={border} aria-label="Mensagem ao proprietário" placeholder="O que falta? (o proprietário verá)" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} />
      )}
      <input className={`${field} w-full`} style={border} aria-label="Observação interna" placeholder="Observação interna (não aparece para o proprietário)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      {m.isError && <p className="text-xs" role="alert" style={{ color: "var(--stayo-danger, #b42318)" }}>{(m.error as Error).message}</p>}
      <div className="flex flex-wrap gap-2">
        {mode === null && <>
          <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ decision: "aprovar", internalNote: internal })}>Aprovar</Button>
          <Button size="sm" variant="outline" onClick={() => setMode("ajustar")}>Ajustar</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("complemento")}>Pedir complemento</Button>
        </>}
        {mode === "ajustar" && <Button size="sm" disabled={m.isPending} onClick={() => {
          const { note: _n, name: _nm, room: _r, ...rest } = vals;
          const values: OwnerProposal = { ...rest, ...(s.kind === "novo_item" ? { name: s.proposed.name, room: s.proposed.room } : {}) };
          m.mutate({ decision: "ajustar", values, internalNote: internal });
        }}>Salvar ajuste</Button>}
        {mode === "complemento" && <Button size="sm" disabled={m.isPending || msg.trim().length < 3} onClick={() => m.mutate({ decision: "complemento", ownerMessage: msg, internalNote: internal })}>Enviar pedido</Button>}
        {mode !== null && <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Cancelar</Button>}
      </div>
    </div>
  );
}
