export type InventoryFilter = "todos" | "faltando" | "resolvidos" | "bloqueadores";

export interface InventoryStateItem {
  module: string;
  required_qty: number;
  existing_qty: number;
  status: string;
  blocks_readiness: boolean;
}

export function inventoryMissingQuantity(
  item: Pick<InventoryStateItem, "required_qty" | "existing_qty">,
) {
  return Math.max(item.required_qty - item.existing_qty, 0);
}

export function isInventoryResolved(item: InventoryStateItem) {
  if (item.status === "instalado" || item.status === "nao_aplicavel") return true;
  return inventoryMissingQuantity(item) === 0;
}

export function isInventoryMissing(item: InventoryStateItem) {
  return !isInventoryResolved(item) && inventoryMissingQuantity(item) > 0;
}

export function isInventoryBlocker(item: InventoryStateItem) {
  return item.blocks_readiness && isInventoryMissing(item);
}

export function matchesInventoryFilter(item: InventoryStateItem, filter: InventoryFilter) {
  if (filter === "faltando") return isInventoryMissing(item);
  if (filter === "resolvidos") return isInventoryResolved(item);
  if (filter === "bloqueadores") return isInventoryBlocker(item);
  return true;
}

export function inventoryStateLabel(item: InventoryStateItem) {
  if (isInventoryResolved(item)) return "Completo";
  return `Falta ${inventoryMissingQuantity(item)}`;
}

export function inventoryOriginLabel(module: string) {
  return module === "faltante" ? "Pendência manual" : "Inventário";
}
