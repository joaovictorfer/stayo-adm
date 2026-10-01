import { supabase } from "@/integrations/supabase/client";
import {
  INVENTORY_GUIDE_TYPE,
  type InventoryAnswer,
  type InventoryRoom,
  type InventorySnapshotItem,
} from "../guided-inventory";

const COLS =
  "id, implementation_id, catalog_item_id, room, category, name, display_order, enabled, tip, inventory_answer";

/** Fonte única: banco (RLS por papel administrativo). Nada em localStorage. */
export async function listGuidedInventory(implementationId: string): Promise<InventorySnapshotItem[]> {
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
export async function ensureGuidedInventorySnapshot(implementationId: string): Promise<number> {
  const { data, error } = await supabase.rpc("admin_apply_guide", {
    p_implementation_id: implementationId,
    p_guide_type: INVENTORY_GUIDE_TYPE,
  });
  if (error) throw error;
  return data ?? 0;
}

export async function openGuidedInventory(implementationId: string) {
  await ensureGuidedInventorySnapshot(implementationId);
  return listGuidedInventory(implementationId);
}

export const guidedInventoryQuery = (implementationId: string) => ({
  queryKey: ["guided-inventory", implementationId] as const,
  queryFn: () => openGuidedInventory(implementationId),
  retry: 1,
});

/** Grava só a escolha. Não cria compra, pendência nem bloqueio. */
export async function setInventoryAnswer(itemId: string, implementationId: string, answer: InventoryAnswer | null) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .update({
      inventory_answer: answer,
      inventory_answered_at: answer ? new Date().toISOString() : null,
      inventory_answered_by: answer ? (u.user?.id ?? null) : null,
    })
    .eq("id", itemId)
    .eq("implementation_id", implementationId)
    .eq("guide_type", INVENTORY_GUIDE_TYPE)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("sem permissão para gravar");
}

export async function addInventoryItem(implementationId: string, room: InventoryRoom, name: string, order: number) {
  const { error } = await supabase.from("implementation_guide_items").insert({
    implementation_id: implementationId,
    guide_type: INVENTORY_GUIDE_TYPE,
    room,
    category: "Adicionado",
    name: name.trim(),
    recommended_quantity: 1,
    classification: "recomendado",
    display_order: order,
  });
  if (error) throw error;
}
