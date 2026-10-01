import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "../../ui/button";
import { InventoryItemDetails } from "./InventoryItemDetails";
import {
  addInventoryItem,
  duplicateInventoryItem,
  guidedInventoryQuery,
  removeInventoryItem,
  setInventoryAnswer,
  updateInventoryDetails,
} from "../../../lib/api/guided-inventory";
import {
  inventoryAnswerLabel,
  inventoryConditionLabel,
  inventoryOriginLabel,
  inventoryRooms,
  roomProgress,
  type InventoryAnswer,
  type InventoryRoom,
  type InventorySnapshotItem,
} from "../../../lib/guided-inventory";

const muted = { color: "var(--stayo-ink-muted)" };
const surface = { backgroundColor: "var(--stayo-surface, #fff)", borderColor: "var(--stayo-border)" };
const ANSWERS: InventoryAnswer[] = ["tenho", "nao_tenho", "nao_aplica"];
type SaveState = "idle" | "saving" | "saved" | "error";

export function GuidedInventorySummary({ implementationId }: { implementationId: string }) {
  const q = useQuery(guidedInventoryQuery(implementationId));
  if (!q.data) return <span>{q.isError ? "Indisponível" : "Carregando…"}</span>;
  const p = roomProgress(q.data);
  return <span>{p.answered} de {p.total} informados</span>;
}

export function GuidedInventoryPanel({ implementationId, title }: { implementationId: string; title?: string }) {
  const qc = useQueryClient();
  const query = guidedInventoryQuery(implementationId);
  const q = useQuery(query);
  const [room, setRoom] = useState<InventoryRoom | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [failed, setFailed] = useState<{ id: string; answer: InventoryAnswer | null } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: query.queryKey });

  const answer = useMutation({
    mutationFn: (v: { id: string; answer: InventoryAnswer | null }) =>
      setInventoryAnswer(v.id, implementationId, v.answer),
    onMutate: async (v) => {
      setSave("saving");
      await qc.cancelQueries({ queryKey: query.queryKey });
      const prev = qc.getQueryData<InventorySnapshotItem[]>(query.queryKey);
      qc.setQueryData<InventorySnapshotItem[]>(query.queryKey, (old) =>
        (old ?? []).map((i) => (i.id === v.id ? { ...i, inventory_answer: v.answer } : i)),
      );
      return { prev };
    },
    onError: (_e, v, ctx) => {
      if (ctx?.prev) qc.setQueryData(query.queryKey, ctx.prev);
      setFailed(v);
      setSave("error");
    },
    onSuccess: () => {
      setFailed(null);
      setSave("saved");
    },
  });

  const add = useMutation({
    mutationFn: (name: string) =>
      addInventoryItem(implementationId, room!, name, 1000 + (q.data?.length ?? 0)),
    onMutate: () => setSave("saving"),
    onSuccess: async () => {
      setAdding("");
      setSave("saved");
      await qc.invalidateQueries({ queryKey: query.queryKey });
    },
    onError: () => setSave("error"),
  });

  if (q.isPending)
    return (
      <div className="flex items-center gap-2 p-4 text-sm" style={muted} role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando inventário…
      </div>
    );
  if (q.isError) {
    const denied = /permiss|42501/i.test(String((q.error as Error)?.message ?? ""));
    return (
      <div className="space-y-2 rounded-lg border p-4 text-sm" style={surface} role="alert">
        <p className="font-medium">{denied ? "Sem permissão para o inventário" : "Não foi possível abrir o inventário"}</p>
        <p style={muted}>{denied ? "Seu perfil não pode ver ou editar esta implantação." : "Verifique a conexão e tente de novo."}</p>
        {!denied && (
          <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
            <RotateCcw className="mr-1 h-4 w-4" /> Tentar de novo
          </Button>
        )}
      </div>
    );
  }

  const items = (q.data ?? []).filter((i) => i.enabled);
  const all = roomProgress(items);
  const roomIdx = room ? inventoryRooms.findIndex((r) => r.key === room) : -1;
  const roomItems = room ? items.filter((i) => i.room === room).sort((a, b) => a.display_order - b.display_order) : [];

  const status = (
    <span className="flex items-center gap-1 text-xs" style={muted} aria-live="polite">
      {save === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</>}
      {save === "saved" && <><Check className="h-3 w-3" /> Salvo</>}
      {save === "error" && (
        <span className="flex items-center gap-2" style={{ color: "var(--stayo-danger, #b42318)" }}>
          Não salvou
          {failed && (
            <button className="underline" onClick={() => answer.mutate(failed)}>Tentar de novo</button>
          )}
        </span>
      )}
    </span>
  );

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {title && <p className="truncate text-xs" style={muted}>{title}</p>}
          <p className="text-sm font-medium">{all.answered} de {all.total} itens informados</p>
          <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full" style={{ backgroundColor: "var(--stayo-border)" }}>
            <div className="h-full" style={{ width: `${all.total ? (all.answered / all.total) * 100 : 0}%`, backgroundColor: "var(--stayo-primary, #0b3150)" }} />
          </div>
        </div>
        {status}
      </header>

      {!room ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {inventoryRooms.map((r) => {
            const p = roomProgress(items.filter((i) => i.room === r.key));
            return (
              <button
                key={r.key}
                onClick={() => setRoom(r.key)}
                className="flex min-h-14 items-center justify-between rounded-lg border px-3 py-2 text-left"
                style={surface}
              >
                <span>
                  <b className="block text-sm">{r.label}</b>
                  <small style={muted}>{p.total ? `${p.answered} de ${p.total} informados` : "Sem itens"}</small>
                </span>
                <ChevronRight className="h-4 w-4" style={muted} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button className="flex items-center gap-1 text-sm" onClick={() => setRoom(null)}>
              <ArrowLeft className="h-4 w-4" /> Ambientes
            </button>
            <b className="text-sm">{inventoryRooms[roomIdx]?.label}</b>
            <span className="flex gap-1">
              <Button size="icon" variant="ghost" aria-label="Ambiente anterior" disabled={roomIdx <= 0} onClick={() => setRoom(inventoryRooms[roomIdx - 1]!.key)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Próximo ambiente" disabled={roomIdx >= inventoryRooms.length - 1} onClick={() => setRoom(inventoryRooms[roomIdx + 1]!.key)}><ChevronRight className="h-4 w-4" /></Button>
            </span>
          </div>

          {roomItems.length === 0 && <p className="rounded-lg border p-3 text-sm" style={{ ...surface, ...muted }}>Nenhum item neste ambiente ainda.</p>}

          <ul className="divide-y rounded-lg border" style={surface}>
            {roomItems.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 px-3 py-2 md:flex-row md:items-center" data-testid="inventory-row">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{i.name}</span>
                  <span className="ml-2 text-[11px]" style={muted}>{inventoryOriginLabel(i)}</span>
                  {!i.inventory_answer && <span className="ml-2 text-[11px]" style={muted}>· Não informado</span>}
                  {(i.inventory_brand || i.inventory_condition || i.inventory_quantity != null) && (
                    <p className="mt-0.5 text-[11px]" style={muted}>
                      {[i.inventory_quantity != null ? `${i.inventory_quantity} un.` : null, i.inventory_brand, i.inventory_condition ? inventoryConditionLabel[i.inventory_condition] : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1" role="radiogroup" aria-label={`Resposta para ${i.name}`}>
                  {ANSWERS.map((a) => {
                    const on = i.inventory_answer === a;
                    return (
                      <button
                        key={a}
                        role="radio"
                        aria-checked={on}
                        onClick={() => answer.mutate({ id: i.id, answer: on ? null : a })}
                        className="min-h-9 flex-1 rounded-md border px-2.5 text-xs md:flex-none"
                        style={on ? { backgroundColor: "var(--stayo-primary, #0b3150)", color: "var(--stayo-on-primary, #fff)", borderColor: "transparent" } : { borderColor: "var(--stayo-border)" }}
                      >
                        {inventoryAnswerLabel[a]}
                      </button>
                    );
                  })}
                  <button className="ml-1 px-1 text-xs underline" style={muted} onClick={() => setDetail(i.id)}>
                    Detalhes
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (adding.trim()) add.mutate(adding); }}
          >
            <input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              placeholder="Ex.: Forma de pizza grande"
              maxLength={120}
              className="h-9 min-w-0 flex-1 rounded-md border px-3 text-sm"
              style={{ borderColor: "var(--stayo-border)" }}
              aria-label="Nome do novo item"
            />
            <Button type="submit" size="sm" disabled={!adding.trim() || add.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar item
            </Button>
          </form>
        </div>
      )}
      <InventoryItemDetails
        item={items.find((i) => i.id === detail) ?? null}
        onClose={() => setDetail(null)}
        onSave={async (d) => { await updateInventoryDetails(detail!, implementationId, d); setSave("saved"); await refresh(); }}
        onDuplicate={async (name) => {
          const src = items.find((i) => i.id === detail)!;
          await duplicateInventoryItem(src, name, src.display_order + 1);
          setSave("saved"); await refresh();
        }}
        onRemove={async () => { await removeInventoryItem(detail!, implementationId); setSave("saved"); await refresh(); }}
      />
    </div>
  );
}
