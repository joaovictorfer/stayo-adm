import { supabase } from "@/integrations/supabase/client";
import { mergeSubAnswer } from "../inventory-subitems";
import {
  buildDuplicate,
  INVENTORY_GUIDE_TYPE,
  type InventoryAnswer,
  type InventoryCondition,
  type InventoryRoom,
  type InventorySnapshotItem,
} from "../guided-inventory";

const COLS =
  "id, implementation_id, catalog_item_id, inventory_room_key, room, category, name, display_order, enabled, tip, inventory_answer, inventory_subanswers, inventory_quantity, inventory_brand, inventory_condition, inventory_internal_notes, base_catalog_item_id, inventory_source, inventory_review_status, inventory_updated_at";

/** Fonte única: banco (RLS por papel administrativo). Nada em localStorage. */
export async function listGuidedInventory(
  implementationId: string,
): Promise<InventorySnapshotItem[]> {
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .select(COLS)
    .eq("implementation_id", implementationId)
    .eq("guide_type", INVENTORY_GUIDE_TYPE)
    .order("room")
    .order("display_order");
  if (error) throw error;
  return (data ?? []) as InventorySnapshotItem[];
}

/** Aplica o catálogo como snapshot (idempotente). Devolve quantos itens novos entraram. */
export async function ensureGuidedInventorySnapshot(
  implementationId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("admin_apply_guide", {
    p_implementation_id: implementationId,
    p_guide_type: INVENTORY_GUIDE_TYPE,
  });
  if (error) throw error;
  return data ?? 0;
}

/** Somente leitura: abrir o inventário nunca aplica o guia. */
export const guidedInventoryQuery = (implementationId: string) => ({
  queryKey: ["guided-inventory", implementationId] as const,
  queryFn: () => listGuidedInventory(implementationId),
  retry: 1,
});

/** Grava só a escolha. Não cria compra, pendência nem bloqueio. */
async function reconcileInventoryMissingItem(
  item: InventorySnapshotItem,
  implementationId: string,
  answer: InventoryAnswer | null,
) {
  const { data: response, error: responseError } = await supabase
    .from("implementation_guide_responses")
    .select("supply_item_id")
    .eq("guide_item_id", item.id)
    .maybeSingle();
  if (responseError) throw responseError;

  let supplyItemId = response?.supply_item_id ?? null;
  if (answer !== null) {
    const { data, error } = await supabase.rpc("admin_quick_mark_guide_item", {
      p_item_id: item.id,
      p_have: answer === "tenho",
    });
    if (error) throw error;
    const result = data as { supplyItemId?: string } | null;
    supplyItemId = result?.supplyItemId ?? supplyItemId;
  }

  if (!supplyItemId) return;
  const status =
    answer === "tenho"
      ? "instalado"
      : answer === "nao_tenho"
        ? "pendente"
        : "nao_aplicavel";
  const existingQty =
    answer === "tenho" ? Math.max(1, item.inventory_quantity ?? 1) : 0;
  const { error } = await supabase
    .from("implementation_supply_items")
    .update({
      name: item.name,
      room: item.room,
      required_qty: Math.max(1, item.inventory_quantity ?? 1),
      existing_qty: existingQty,
      status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", supplyItemId)
    .eq("implementation_id", implementationId);
  if (error) throw error;
}

export async function setInventoryAnswer(
  item: InventorySnapshotItem,
  implementationId: string,
  answer: InventoryAnswer | null,
) {
  // O fluxo oficial de itens faltantes continua em implementation_supply_items.
  // A resposta guiada apenas o alimenta/reconcilia pelo vínculo já existente em
  // implementation_guide_responses.supply_item_id; não nasce uma segunda lista.
  await reconcileInventoryMissingItem(item, implementationId, answer);
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .update({
      inventory_answer: answer,
      inventory_answered_at: answer ? new Date().toISOString() : null,
      inventory_answered_by: answer ? (u.user?.id ?? null) : null,
    })
    .eq("id", item.id)
    .eq("implementation_id", implementationId)
    .eq("guide_type", INVENTORY_GUIDE_TYPE)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("sem permissão para gravar");
}

/**
 * Contagem rápida pelo toque: quantidade > 0 marca "tenho" com a quantidade;
 * zerar marca "não tenho". Reconcilia a lista de compras pelo mesmo vínculo.
 */
export async function setInventoryCount(
  item: InventorySnapshotItem,
  implementationId: string,
  qty: number,
) {
  const n = Math.max(0, Math.floor(qty));
  const next = { ...item, inventory_quantity: n > 0 ? n : (item.inventory_quantity ?? null) };
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .update({ inventory_quantity: n > 0 ? n : null })
    .eq("id", item.id)
    .eq("implementation_id", implementationId)
    .eq("guide_type", INVENTORY_GUIDE_TYPE)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("sem permissão para gravar");
  await setInventoryAnswer(next, implementationId, n > 0 ? "tenho" : "nao_tenho");
}

/** Grava só a resposta de um subitem (ex.: prato do jogo de jantar). Sem pendência nem segunda lista. */
export async function setInventorySubanswer(
  item: InventorySnapshotItem,
  implementationId: string,
  subKey: string,
  answer: "tenho" | "nao_tenho" | null,
) {
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .update({
      inventory_subanswers: mergeSubAnswer(item.inventory_subanswers, subKey, answer),
    })
    .eq("id", item.id)
    .eq("implementation_id", implementationId)
    .eq("guide_type", INVENTORY_GUIDE_TYPE)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("sem permissão para gravar");
}

export async function addInventoryItem(
  implementationId: string,
  room: InventoryRoom,
  name: string,
  order: number,
  category = "Adicionado",
  details?: Omit<InventoryDetails, "name">,
) {
  const { error } = await supabase.from("implementation_guide_items").insert({
    implementation_id: implementationId,
    guide_type: INVENTORY_GUIDE_TYPE,
    room,
    category,
    name: name.trim(),
    recommended_quantity: 1,
    classification: "recomendado",
    display_order: order,
    inventory_source: "equipe",
    ...details,
  });
  if (error) throw error;
}

export interface InventoryDetails {
  name: string;
  inventory_quantity: number | null;
  inventory_brand: string | null;
  inventory_condition: InventoryCondition | null;
  inventory_internal_notes: string | null;
}

/** Detalhes opcionais. Autor/data gravados pelo banco. Não cria compra nem pendência. */
export async function updateInventoryDetails(
  itemId: string,
  implementationId: string,
  d: InventoryDetails,
) {
  const name = d.name.trim();
  if (!name) throw new Error("Informe o nome do item");
  const clean = (s: string | null) => (s && s.trim() ? s.trim() : null);
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .update({
      name,
      inventory_quantity: d.inventory_quantity,
      inventory_brand: clean(d.inventory_brand),
      inventory_condition: d.inventory_condition,
      inventory_internal_notes: clean(d.inventory_internal_notes),
    })
    .eq("id", itemId)
    .eq("implementation_id", implementationId)
    .eq("guide_type", INVENTORY_GUIDE_TYPE)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("sem permissão para gravar");
}

export async function duplicateInventoryItem(
  src: InventorySnapshotItem,
  order: number,
) {
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .insert(buildDuplicate(src, `${src.name} (cópia)`, order))
    .select(COLS)
    .single();
  if (error) throw error;
  return data as InventorySnapshotItem;
}

/** Só cópias e itens novos podem ser removidos; itens do catálogo voltariam no próximo snapshot. */
export async function removeInventoryItem(
  itemId: string,
  implementationId: string,
) {
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .delete()
    .eq("id", itemId)
    .eq("implementation_id", implementationId)
    .eq("guide_type", INVENTORY_GUIDE_TYPE)
    .is("catalog_item_id", null)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("sem permissão para remover");
}

/**
 * Comodidades → inventário guiado. Marcado vira "Tenho" com quantidade/marca;
 * desmarcado só desativa o item (nunca vira "Não tenho" nem cria pendência).
 */
export async function syncAmenitiesToInventory(
  implementationId: string,
  rows: import("../amenities-sync").SyncRow[],
) {
  const { data: existing, error: e1 } = await supabase
    .from("implementation_guide_items")
    .select("id, amenity_key")
    .eq("implementation_id", implementationId)
    .not("amenity_key", "is", null);
  if (e1) throw e1;
  const known = new Set((existing ?? []).map((r) => r.amenity_key));
  const payload = rows
    .filter((r) => r.on || known.has(r.amenity_key))
    .map((r) => ({
      implementation_id: implementationId,
      guide_type: INVENTORY_GUIDE_TYPE,
      amenity_key: r.amenity_key,
      room: r.room,
      category: "Comodidades",
      name: r.name,
      recommended_quantity: 1,
      classification: "recomendado",
      display_order: r.order,
      inventory_source: "equipe",
      enabled: r.on,
      inventory_answer: r.on ? ("tenho" as const) : null,
      inventory_quantity: r.on ? r.qty : null,
      inventory_brand: r.on ? r.brand : null,
      inventory_internal_notes: r.on ? r.notes : null,
    }));
  // Itens removidos do painel (ambiente ou item livre apagado) também saem de uso.
  const live = new Set(rows.map((r) => r.amenity_key));
  const gone = (existing ?? [])
    .filter((r) => r.amenity_key && !live.has(r.amenity_key))
    .map((r) => r.id);
  if (payload.length) {
    const { error } = await supabase
      .from("implementation_guide_items")
      .upsert(payload as never, {
        onConflict: "implementation_id,amenity_key",
      });
    if (error) throw error;
  }
  if (gone.length) {
    const { error } = await supabase
      .from("implementation_guide_items")
      .update({ enabled: false, inventory_answer: null })
      .in("id", gone);
    if (error) throw error;
  }
}

/**
 * Replica os itens do Quarto 1 para os demais quartos declarados (categoria "Quarto N").
 * Idempotente: só cria o que ainda não existe pelo nome naquele quarto. Respostas não são copiadas.
 */
export async function replicateBedroomItems(implementationId: string, bedrooms: number) {
  if (bedrooms < 2) return 0;
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .select("room, category, name, tip, description, quantity_text, image_path, purchase_url, recommended_quantity, classification, display_order, catalog_item_id, base_catalog_item_id, enabled")
    .eq("implementation_id", implementationId)
    .eq("guide_type", INVENTORY_GUIDE_TYPE)
    .eq("room", "quartos");
  if (error) throw error;
  const rows = data ?? [];
  const num = (c: string | null) => Number(/^Quarto (\d+)$/.exec(c ?? "")?.[1] ?? 1);
  const base = rows.filter((r) => r.enabled && num(r.category) === 1);
  const inserts = [];
  for (let k = 2; k <= bedrooms; k++) {
    const have = new Set(rows.filter((r) => num(r.category) === k).map((r) => r.name.trim().toLowerCase()));
    for (const r of base) {
      if (have.has(r.name.trim().toLowerCase())) continue;
      inserts.push({
        implementation_id: implementationId,
        guide_type: INVENTORY_GUIDE_TYPE,
        room: "quartos",
        category: `Quarto ${k}`,
        name: r.name,
        tip: r.tip,
        description: r.description,
        quantity_text: r.quantity_text,
        image_path: r.image_path,
        purchase_url: r.purchase_url,
        recommended_quantity: r.recommended_quantity,
        classification: r.classification,
        display_order: r.display_order,
        catalog_item_id: null,
        base_catalog_item_id: r.catalog_item_id ?? r.base_catalog_item_id ?? null,
        inventory_source: "equipe" as const,
      });
    }
  }
  if (!inserts.length) return 0;
  const { error: e2 } = await supabase.from("implementation_guide_items").insert(inserts);
  if (e2) throw e2;
  return inserts.length;
}

/** Igual aos quartos: copia os itens do Banheiro 1 para os demais banheiros sociais, sem respostas. */
export async function replicateBathroomItems(implementationId: string, bedrooms: number) {
  if (bedrooms < 2) return 0;
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .select("room, category, name, tip, description, quantity_text, image_path, purchase_url, recommended_quantity, classification, display_order, catalog_item_id, base_catalog_item_id, enabled")
    .eq("implementation_id", implementationId)
    .eq("guide_type", INVENTORY_GUIDE_TYPE)
    .eq("room", "banheiros");
  if (error) throw error;
  const rows = data ?? [];
  const num = (c: string | null) => Number(/^Banheiro (\d+)$/.exec(c ?? "")?.[1] ?? 1);
  const isLavabo = (c: string | null) => /^Lavabo \d+$/.test(c ?? "");
  const base = rows.filter((r) => !isLavabo(r.category)).filter((r) => r.enabled && num(r.category) === 1);
  const inserts = [];
  for (let k = 2; k <= bedrooms; k++) {
    const have = new Set(rows.filter((r) => !isLavabo(r.category) && num(r.category) === k).map((r) => r.name.trim().toLowerCase()));
    for (const r of base) {
      if (have.has(r.name.trim().toLowerCase())) continue;
      inserts.push({
        implementation_id: implementationId,
        guide_type: INVENTORY_GUIDE_TYPE,
        room: "banheiros",
        category: `Banheiro ${k}`,
        name: r.name,
        tip: r.tip,
        description: r.description,
        quantity_text: r.quantity_text,
        image_path: r.image_path,
        purchase_url: r.purchase_url,
        recommended_quantity: r.recommended_quantity,
        classification: r.classification,
        display_order: r.display_order,
        catalog_item_id: null,
        base_catalog_item_id: r.catalog_item_id ?? r.base_catalog_item_id ?? null,
        inventory_source: "equipe" as const,
      });
    }
  }
  if (!inserts.length) return 0;
  const { error: e2 } = await supabase.from("implementation_guide_items").insert(inserts);
  if (e2) throw e2;
  return inserts.length;
}
