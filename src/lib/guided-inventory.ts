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
  inventory_room_key?: string | null;
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
  /** Respostas de subitens (ex.: pratos do jogo de jantar). */
  inventory_subanswers?: Record<string, InventoryAnswer | null> | null;
  inventory_quantity?: number | null;
  inventory_brand?: string | null;
  inventory_condition?: InventoryCondition | null;
  inventory_internal_notes?: string | null;
  base_catalog_item_id?: string | null;
  inventory_source?: "equipe" | "proprietario";
  inventory_review_status?: "preenchido_stayo" | "revisado_stayo";
  inventory_updated_at?: string | null;
}

export type InventoryCondition = "novo" | "bom" | "desgaste" | "trocar" | "atencao" | "danificado";
export const inventoryConditionLabel: Record<InventoryCondition, string> = {
  novo: "Novo",
  bom: "Bom",
  desgaste: "Desgaste",
  trocar: "Trocar",
  atencao: "Atenção",
  danificado: "Danificado",
};
/** Estados usados na vistoria de implantação (os demais são legados). */
export const surveyConditions = ["novo", "bom", "desgaste", "trocar"] as const;

/** Origem exibida: catálogo, cópia de um item-base ou item novo (equipe/proprietário). */
export function inventoryOriginLabel(i: Pick<InventorySnapshotItem, "catalog_item_id" | "base_catalog_item_id" | "inventory_source">): string {
  if (i.catalog_item_id) return "recomendado";
  if (i.base_catalog_item_id) return "variação";
  return i.inventory_source === "proprietario" ? "Informado pelo proprietário" : "Adicionado pela equipe";
}

/** Payload da cópia: mesmo ambiente e item-base, nome novo obrigatório; sem resposta, foto ou observação. */
export function buildDuplicate(src: InventorySnapshotItem, newName: string, order: number) {
  const name = newName.trim();
  if (!name) throw new Error("Informe o nome da cópia");
  if (name.toLowerCase() === src.name.trim().toLowerCase()) throw new Error("Use um nome diferente do original");
  return {
    implementation_id: src.implementation_id,
    guide_type: INVENTORY_GUIDE_TYPE,
    room: src.room,
    category: src.category,
    name,
    tip: src.tip,
    recommended_quantity: 1,
    classification: "recomendado",
    display_order: order,
    catalog_item_id: null,
    base_catalog_item_id: src.catalog_item_id ?? src.base_catalog_item_id ?? null,
    inventory_source: "equipe" as const,
  };
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
