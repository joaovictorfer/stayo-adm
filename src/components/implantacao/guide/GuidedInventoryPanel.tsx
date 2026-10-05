import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";

import { Button } from "../../ui/button";
import { InventoryItemDetails } from "./InventoryItemDetails";
import { InventorySubmissionsReview } from "./InventorySubmissionsReview";
import {
  addInventoryItem,
  duplicateInventoryItem,
  guidedInventoryQuery,
  removeInventoryItem,
  setInventoryAnswer,
  updateInventoryDetails,
} from "../../../lib/api/guided-inventory";
import {
  inventoryConditionLabel,
  inventoryOriginLabel,
  roomProgress,
  type InventoryAnswer,
  type InventoryRoom,
  type InventorySnapshotItem,
} from "../../../lib/guided-inventory";

const muted = { color: "var(--stayo-ink-muted)" };
const surface = {
  backgroundColor: "var(--stayo-surface, #fff)",
  borderColor: "var(--stayo-border)",
};
const ANSWERS: InventoryAnswer[] = ["tenho", "nao_tenho", "nao_aplica"];
const ANSWER_LABEL: Record<InventoryAnswer, string> = {
  tenho: "Tem",
  nao_tenho: "Falta",
  nao_aplica: "N/A",
};
const PREPARATION_ROOMS: Array<{
  id:
    | "cozinha"
    | "sala"
    | "quarto1"
    | "quarto2"
    | "banheiro"
    | "lavanderia"
    | "outros";
  label: string;
}> = [
  { id: "cozinha", label: "Cozinha" },
  { id: "sala", label: "Sala" },
  { id: "quarto1", label: "Quarto 1" },
  { id: "quarto2", label: "Quarto 2" },
  { id: "banheiro", label: "Banheiro" },
  { id: "lavanderia", label: "Lavanderia" },
  { id: "outros", label: "Outros" },
];
type PreparationRoom = (typeof PREPARATION_ROOMS)[number]["id"];
const inPreparationRoom = (
  item: InventorySnapshotItem,
  room: PreparationRoom,
) => {
  if (room === "quarto1")
    return item.room === "quartos" && item.category !== "Quarto 2";
  if (room === "quarto2")
    return item.room === "quartos" && item.category === "Quarto 2";
  if (room === "banheiro") return item.room === "banheiros";
  if (room === "outros")
    return item.room === "outros" || item.room === "externa";
  return item.room === room;
};
const persistedRoom = (room: PreparationRoom): InventoryRoom => {
  if (room === "quarto1" || room === "quarto2") return "quartos";
  if (room === "banheiro") return "banheiros";
  return room as InventoryRoom;
};
type SaveState = "idle" | "saving" | "saved" | "error";

export function GuidedInventorySummary({
  implementationId,
}: {
  implementationId: string;
}) {
  const q = useQuery(guidedInventoryQuery(implementationId));
  if (!q.data) return <span>{q.isError ? "Indisponível" : "Carregando…"}</span>;
  const p = roomProgress(q.data);
  return (
    <span>
      {p.answered} de {p.total} informados
    </span>
  );
}

export function GuidedInventoryPanel({
  implementationId,
  title,
}: {
  implementationId: string;
  title?: string;
}) {
  const qc = useQueryClient();
  const query = guidedInventoryQuery(implementationId);
  const q = useQuery(query);
  const [room, setRoom] = useState<PreparationRoom>("cozinha");
  const [save, setSave] = useState<SaveState>("idle");
  const [failed, setFailed] = useState<{
    item: InventorySnapshotItem;
    answer: InventoryAnswer | null;
  } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: query.queryKey });

  const answer = useMutation({
    mutationFn: (v: {
      item: InventorySnapshotItem;
      answer: InventoryAnswer | null;
    }) => setInventoryAnswer(v.item, implementationId, v.answer),
    onMutate: async (v) => {
      setSave("saving");
      await qc.cancelQueries({ queryKey: query.queryKey });
      const prev = qc.getQueryData<InventorySnapshotItem[]>(query.queryKey);
      qc.setQueryData<InventorySnapshotItem[]>(query.queryKey, (old) =>
        (old ?? []).map((i) =>
          i.id === v.item.id ? { ...i, inventory_answer: v.answer } : i,
        ),
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
      addInventoryItem(
        implementationId,
        persistedRoom(room),
        name,
        1000 + (q.data?.length ?? 0),
        room === "quarto2" ? "Quarto 2" : undefined,
      ),
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
      <div
        className="flex items-center gap-2 p-4 text-sm"
        style={muted}
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando inventário…
      </div>
    );
  if (q.isError) {
    const denied = /permiss|42501/i.test(
      String((q.error as Error)?.message ?? ""),
    );
    return (
      <div
        className="space-y-2 rounded-lg border p-4 text-sm"
        style={surface}
        role="alert"
      >
        <p className="font-medium">
          {denied
            ? "Sem permissão para o inventário"
            : "Não foi possível abrir o inventário"}
        </p>
        <p style={muted}>
          {denied
            ? "Seu perfil não pode ver ou editar esta implantação."
            : "Verifique a conexão e tente de novo."}
        </p>
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
  const roomItems = items
    .filter((i) => inPreparationRoom(i, room))
    .sort((a, b) => a.display_order - b.display_order);

  const status = (
    <span
      className="flex items-center gap-1 text-xs"
      style={muted}
      aria-live="polite"
    >
      {save === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
        </>
      )}
      {save === "saved" && (
        <>
          <Check className="h-3 w-3" /> Salvo
        </>
      )}
      {save === "error" && (
        <span
          className="flex items-center gap-2"
          style={{ color: "var(--stayo-danger, #b42318)" }}
        >
          Não salvou
          {failed && (
            <button className="underline" onClick={() => answer.mutate(failed)}>
              Tentar de novo
            </button>
          )}
        </span>
      )}
    </span>
  );

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {title && (
            <p className="truncate text-xs" style={muted}>
              {title}
            </p>
          )}
          <p className="text-sm font-medium">
            {all.answered} de {all.total} itens informados
          </p>
          <div
            className="mt-1 h-1.5 w-40 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--stayo-border)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${all.total ? (all.answered / all.total) * 100 : 0}%`,
                backgroundColor: "var(--stayo-primary, #0b3150)",
              }}
            />
          </div>
        </div>
        {status}
      </header>

      <InventorySubmissionsReview
        implementationId={implementationId}
        items={items}
      />

      <div
        className="flex gap-1.5 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Ambientes do inventário"
      >
        {PREPARATION_ROOMS.map((r) => {
          const p = roomProgress(
            items.filter((i) => inPreparationRoom(i, r.id)),
          );
          const active = room === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setRoom(r.id);
                setDetail(null);
              }}
              className="min-h-10 shrink-0 rounded-full border px-3 text-xs font-medium"
              style={
                active
                  ? {
                      backgroundColor: "var(--stayo-forest)",
                      color: "var(--primary-foreground)",
                      borderColor: "var(--stayo-forest)",
                    }
                  : surface
              }
            >
              {r.label}{" "}
              <span className="opacity-70">
                {p.answered}/{p.total}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {roomItems.length === 0 && (
          <p
            className="rounded-lg border p-3 text-sm"
            style={{ ...surface, ...muted }}
          >
            Nenhum item neste ambiente ainda.
          </p>
        )}

        <ul className="divide-y rounded-lg border" style={surface}>
          {roomItems.map((i) => (
            <li key={i.id} className="px-3 py-2" data-testid="inventory-row">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{i.name}</span>
                  <span className="ml-2 text-[11px]" style={muted}>
                    {inventoryOriginLabel(i)}
                  </span>
                  {!i.inventory_answer ? (
                    <span className="ml-2 text-[11px]" style={muted}>
                      · Não informado
                    </span>
                  ) : (
                    <span className="ml-2 text-[11px]" style={muted}>
                      ·{" "}
                      {i.inventory_review_status === "revisado_stayo"
                        ? "Revisado pela STAYO"
                        : "Preenchido pela STAYO"}
                    </span>
                  )}
                  {(i.inventory_brand ||
                    i.inventory_condition ||
                    i.inventory_quantity != null) && (
                    <p className="mt-0.5 text-[11px]" style={muted}>
                      {[
                        i.inventory_quantity != null
                          ? `${i.inventory_quantity} un.`
                          : null,
                        i.inventory_brand,
                        i.inventory_condition
                          ? inventoryConditionLabel[i.inventory_condition]
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div
                  className="flex items-center gap-1"
                  role="radiogroup"
                  aria-label={`Resposta para ${i.name}`}
                >
                  {ANSWERS.map((a) => {
                    const on = i.inventory_answer === a;
                    return (
                      <button
                        key={a}
                        role="radio"
                        aria-checked={on}
                        onClick={() =>
                          answer.mutate({ item: i, answer: on ? null : a })
                        }
                        className="min-h-9 flex-1 rounded-md border px-2.5 text-xs md:flex-none"
                        style={
                          on
                            ? {
                                backgroundColor:
                                  "var(--stayo-primary, #0b3150)",
                                color: "var(--stayo-on-primary, #fff)",
                                borderColor: "transparent",
                              }
                            : { borderColor: "var(--stayo-border)" }
                        }
                      >
                        {ANSWER_LABEL[a]}
                      </button>
                    );
                  })}
                  <button
                    className="ml-1 inline-flex min-h-9 items-center gap-1 px-1 text-xs"
                    style={muted}
                    onClick={() => setDetail(detail === i.id ? null : i.id)}
                    aria-expanded={detail === i.id}
                  >
                    {detail === i.id ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}{" "}
                    Detalhes
                  </button>
                </div>
              </div>
              {detail === i.id && (
                <InventoryItemDetails
                  item={i}
                  onClose={() => setDetail(null)}
                  onSave={async (d) => {
                    setSave("saving");
                    await updateInventoryDetails(i.id, implementationId, d);
                    setSave("saved");
                    await refresh();
                  }}
                  onDuplicate={async () => {
                    setSave("saving");
                    const copy = await duplicateInventoryItem(
                      i,
                      i.display_order + 1,
                    );
                    setSave("saved");
                    await refresh();
                    setDetail(copy.id);
                  }}
                  onRemove={async () => {
                    setSave("saving");
                    await removeInventoryItem(i.id, implementationId);
                    setSave("saved");
                    await refresh();
                  }}
                />
              )}
            </li>
          ))}
        </ul>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (adding.trim()) add.mutate(adding);
          }}
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
          <Button
            type="submit"
            size="sm"
            disabled={!adding.trim() || add.isPending}
          >
            <Plus className="mr-1 h-4 w-4" /> Adicionar item
          </Button>
        </form>
      </div>
    </div>
  );
}
