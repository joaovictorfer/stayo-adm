import { supabase } from "@/integrations/supabase/client";
import type { InventoryAnswer, InventoryCondition, InventoryRoom } from "../guided-inventory";

/**
 * Inventário do proprietário: só sessão autenticada + vínculo validado no banco
 * (`owner_can_access_implementation`). O proprietário nunca grava no item:
 * cada envio vira proposta em revisão da STAYO.
 */
export interface OwnerInventoryItem {
  id: string;
  room: InventoryRoom;
  name: string;
  category: string;
  tip: string | null;
  displayOrder: number;
  recommended: boolean;
  source: "equipe" | "proprietario";
  reviewStatus: "preenchido_stayo" | "revisado_stayo";
  answer: InventoryAnswer | null;
  quantity: number | null;
  brand: string | null;
  condition: InventoryCondition | null;
}
export interface OwnerProposal {
  answer?: InventoryAnswer | undefined;
  quantity?: number | undefined;
  brand?: string | undefined;
  condition?: InventoryCondition | undefined;
  note?: string | undefined;
  name?: string | undefined;
  room?: InventoryRoom | undefined;
}
export interface OwnerSubmission {
  id: string;
  itemId: string | null;
  kind: "item" | "novo_item";
  proposed: OwnerProposal;
  status: "enviado" | "complemento_solicitado";
  ownerMessage: string | null;
  updatedAt: string;
}
export interface OwnerInventory {
  implementation: { id: string; code: string; nickname: string | null; condominiumName: string | null; unit: string | null };
  items: OwnerInventoryItem[];
  submissions: OwnerSubmission[];
}

export const ownerInventoryQuery = (implementationId: string) => ({
  queryKey: ["owner-inventory", implementationId] as const,
  queryFn: async (): Promise<OwnerInventory> => {
    const { data, error } = await supabase.rpc("owner_inventory_resolve", { p_implementation_id: implementationId });
    if (error) throw error;
    return data as unknown as OwnerInventory;
  },
  retry: 1,
});

export async function ownerSubmitInventory(implementationId: string, itemId: string | null, proposal: OwnerProposal) {
  const { error } = await supabase.rpc("owner_inventory_submit", {
    p_implementation_id: implementationId,
    p_item_id: itemId as string,
    p_data: proposal as never,
  });
  if (error) throw error;
}

// ---------- Equipe STAYO ----------
export interface InventorySubmissionRow {
  id: string;
  item_id: string | null;
  kind: "item" | "novo_item";
  proposed: OwnerProposal;
  previous: Record<string, unknown> | null;
  status: "enviado" | "aprovado" | "ajustado" | "complemento_solicitado";
  owner_message: string | null;
  decision_internal_note: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export const inventorySubmissionsQuery = (implementationId: string) => ({
  queryKey: ["guided-inventory-submissions", implementationId] as const,
  queryFn: async (): Promise<InventorySubmissionRow[]> => {
    const { data, error } = await supabase
      .from("implementation_inventory_submissions")
      .select("id, item_id, kind, proposed, previous, status, owner_message, decision_internal_note, decided_at, created_at, updated_at")
      .eq("implementation_id", implementationId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as InventorySubmissionRow[];
  },
});

export type ReviewDecision =
  | { decision: "aprovar"; internalNote?: string | undefined }
  | { decision: "ajustar"; values: OwnerProposal; internalNote?: string | undefined }
  | { decision: "complemento"; ownerMessage: string; internalNote?: string | undefined };

export async function reviewInventorySubmission(submissionId: string, d: ReviewDecision) {
  const { error } = await supabase.rpc("admin_review_inventory_submission", {
    p_data: { submissionId, ...d } as never,
  });
  if (error) throw error;
}
