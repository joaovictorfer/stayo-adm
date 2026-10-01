/** Inventário guiado: bens por ambiente. Não se mistura com Enxoval (guide_type próprio). */
export const INVENTORY_GUIDE_TYPE = "inventario" as const;

export const inventoryRooms = [
  { key: "cozinha", label: "Cozinha" },
  { key: "sala", label: "Sala" },
  { key: "quartos", label: "Quartos" },
  { key: "banheiros", label: "Banheiros" },
  { key: "lavanderia", label: "Lavanderia" },
  { key: "externa", label: "Varanda/área externa" },
  { key: "outros", label: "Outros" },
] as const;

export type InventoryRoom = (typeof inventoryRooms)[number]["key"];

export interface InventoryCatalogItem {
  id: string;
  room: InventoryRoom;
  category: string;
  name: string;
  display_order: number;
  active: boolean;
  tip: string | null;
}

export type InventoryAnswer = "tenho" | "nao_tenho" | "nao_aplica";
export const inventoryAnswerLabel: Record<InventoryAnswer, string> = {
  tenho: "Tenho",
  nao_tenho: "Não tenho",
  nao_aplica: "Não se aplica",
};

export interface InventorySnapshotItem {
  id: string;
  implementation_id: string;
  catalog_item_id: string | null;
  room: InventoryRoom;
  category: string;
  name: string;
  display_order: number;
  enabled: boolean;
  tip: string | null;
  inventory_answer?: InventoryAnswer | null;
}

/**
 * Espelha `admin_apply_guide`: copia os itens ativos ainda ausentes da implantação.
 * O snapshot nasce como cópia independente — mudar o catálogo depois não o altera.
 */
export function buildSnapshot(
  implementationId: string,
  catalog: InventoryCatalogItem[],
  existing: Pick<InventorySnapshotItem, "catalog_item_id">[],
  newId: () => string,
): InventorySnapshotItem[] {
  const already = new Set(existing.map((e) => e.catalog_item_id));
  return catalog
    .filter((c) => c.active && !already.has(c.id))
    .map((c) => ({
      id: newId(),
      implementation_id: implementationId,
      catalog_item_id: c.id,
      room: c.room,
      category: c.category,
      name: c.name,
      display_order: c.display_order,
      enabled: true,
      tip: c.tip,
    }));
}

export function groupByRoom(items: InventorySnapshotItem[]) {
  return inventoryRooms
    .map((r) => ({
      ...r,
      items: items
        .filter((i) => i.room === r.key)
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.items.length > 0);
}

/** Progresso por ambiente: "confirmado" = qualquer resposta (Não informado não conta). */
export function roomProgress(items: InventorySnapshotItem[]) {
  const enabled = items.filter((i) => i.enabled);
  return { total: enabled.length, answered: enabled.filter((i) => i.inventory_answer).length };
}
