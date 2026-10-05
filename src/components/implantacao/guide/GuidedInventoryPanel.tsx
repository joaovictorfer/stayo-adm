import { InventoryWorkspace } from "../ficha/FichaImplantacao";
import { inventorySubmissionsQuery } from "../../../lib/api/owner-inventory";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, Loader2, Plus, RotateCcw } from "lucide-react";
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
  id: "cozinha" | "sala" | "quarto1" | "quarto2" | "banheiro" | "lavanderia" | "outros";
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
const inPreparationRoom = (item: InventorySnapshotItem, room: PreparationRoom) => {
  if (room === "quarto1") return item.room === "quartos" && item.category !== "Quarto 2";
  if (room === "quarto2") return item.room === "quartos" && item.category === "Quarto 2";
  if (room === "banheiro") return item.room === "banheiros";
  if (room === "outros") return item.room === "outros" || item.room === "externa";
  return item.room === room;
};
const persistedRoom = (room: PreparationRoom): InventoryRoom => {
  if (room === "quarto1" || room === "quarto2") return "quartos";
  if (room === "banheiro") return "banheiros";
  return room as InventoryRoom;
};
type SaveState = "idle" | "saving" | "saved" | "error";

export function GuidedInventorySummary({ implementationId }: { implementationId: string }) {
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
}: {
  implementationId: string;
  title?: string;
}) {
  const [adding, setAdding] = useState(false);
  const subs = useQuery(inventorySubmissionsQuery(implementationId));
  const ids = new Set(
    (subs.data ?? [])
      .filter((s) => s.status === "enviado")
      .map((s) => s.item_id)
      .filter((x): x is string => !!x),
  );
  return (
    <div className="space-y-2">
      <InventoryWorkspace
        implementationId={implementationId}
        adding={adding}
        setAdding={setAdding}
        reviewing={ids.size > 0}
        pendingReviewIds={ids}
      />
      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-10 items-center gap-1 text-sm font-medium"
          style={{ color: "var(--stayo-navy)" }}
        >
          + Adicionar item
        </button>
      )}
    </div>
  );
}
