export type InventoryStatus = "pendente" | "comprado" | "entregue" | "instalado" | "nao_aplicavel";
export type InventoryPriority = "baixa" | "media" | "alta";
export type InventoryFilter = "todos" | "faltando" | "resolvidos" | "bloqueadores";

export interface InventoryItem {
  id: string;
  module: string;
  name: string;
  room: string | null;
  size: string | null;
  required_qty: number;
  existing_qty: number;
  status: InventoryStatus;
  priority: InventoryPriority;
  responsible: string | null;
  blocks_readiness: boolean;
  notes: string | null;
}

export const inventoryKey = (name: string, room: string | null | undefined) =>
  [name, room || "Geral"]
    .map((value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");

export function deriveInventoryState(item: InventoryItem) {
  const origin = item.module === "faltante" ? "manual" as const : "inventory" as const;
  const dismissed = item.status === "nao_aplicavel";
  const quantityMissing = Math.max(0, item.required_qty - item.existing_qty);
  const resolved = origin === "manual" ? item.status === "instalado" || dismissed : quantityMissing === 0 || dismissed;
  return {
    item,
    origin,
    missingQty: resolved ? 0 : origin === "manual" ? Math.max(1, quantityMissing) : quantityMissing,
    resolved,
    blocker: !resolved && item.blocks_readiness,
  };
}

export function filterInventory(items: InventoryItem[], filter: InventoryFilter) {
  const states = items.map(deriveInventoryState);
  if (filter === "faltando") return states.filter((state) => !state.resolved);
  if (filter === "resolvidos") return states.filter((state) => state.resolved);
  if (filter === "bloqueadores") return states.filter((state) => state.blocker);
  return states;
}

export function hasOpenInventoryDuplicate(items: InventoryItem[], name: string, room: string | null | undefined, exceptId?: string) {
  const key = inventoryKey(name, room);
  return items.some((item) => item.id !== exceptId && inventoryKey(item.name, item.room) === key && !deriveInventoryState(item).resolved);
}