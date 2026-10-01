import { supabase } from "@/integrations/supabase/client";
import { INVENTORY_GUIDE_TYPE, type InventorySnapshotItem } from "../guided-inventory";

/** Fonte única: banco (RLS por papel administrativo). Nada em localStorage. */
export async function listGuidedInventory(implementationId: string): Promise<InventorySnapshotItem[]> {
  const { data, error } = await supabase
    .from("implementation_guide_items")
    .select("id, implementation_id, catalog_item_id, room, category, name, display_order, enabled, tip")
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

/** Abrir = garantir snapshot e ler. Erros sobem para o chamador exibir com retry. */
export async function openGuidedInventory(implementationId: string) {
  await ensureGuidedInventorySnapshot(implementationId);
  return listGuidedInventory(implementationId);
}

export const guidedInventoryQuery = (implementationId: string) => ({
  queryKey: ["guided-inventory", implementationId] as const,
  queryFn: () => openGuidedInventory(implementationId),
  retry: 2,
});
