import { supabase } from "../../integrations/supabase/client";

export interface OpportunityPreparationSummary {
  checked: number;
  missing: number;
}

type InventoryReviewRow = {
  inventory_answer: string | null;
};

type SupplyReviewRow = {
  existing_qty: number | null;
  required_qty: number | null;
  status: string | null;
};

export function countPreparationReview(
  inventory: InventoryReviewRow[],
  supplies: SupplyReviewRow[],
): OpportunityPreparationSummary {
  return {
    checked: inventory.filter((item) => item.inventory_answer != null).length,
    missing: supplies.filter(
      (item) =>
        item.status !== "nao_aplicavel" &&
        Number(item.required_qty ?? 0) > Number(item.existing_qty ?? 0),
    ).length,
  };
}

/**
 * Resumo somente-leitura da etapa de preparação.
 *
 * `implementation_supply_items` continua sendo a fonte oficial de faltantes;
 * a revisão não cria uma segunda lista nem materializa novos registros.
 */
export async function loadOpportunityPreparationSummary(
  implementationId: string,
): Promise<OpportunityPreparationSummary> {
  const [inventoryResult, suppliesResult] = await Promise.all([
    supabase
      .from("implementation_guide_items")
      .select("inventory_answer")
      .eq("implementation_id", implementationId)
      .eq("guide_type", "inventario")
      .eq("enabled", true),
    supabase
      .from("implementation_supply_items")
      .select("required_qty, existing_qty, status")
      .eq("implementation_id", implementationId),
  ]);

  if (inventoryResult.error) throw inventoryResult.error;
  if (suppliesResult.error) throw suppliesResult.error;

  return countPreparationReview(
    (inventoryResult.data ?? []) as InventoryReviewRow[],
    (suppliesResult.data ?? []) as SupplyReviewRow[],
  );
}

export const opportunityPreparationSummaryQuery = (
  implementationId: string,
) => ({
  queryKey: ["opportunity", "review", "preparation", implementationId] as const,
  queryFn: () => loadOpportunityPreparationSummary(implementationId),
  retry: 1,
});
