import { getSupabaseBrowserClient } from "./supabase-client";

export type PayoutAmountField = "gross" | "cleaning" | "platform_fee" | "owner_direct";
export const PAYOUT_FIELD_LABEL: Record<PayoutAmountField, string> = {
  gross: "Valor bruto da reserva",
  cleaning: "Taxa de limpeza",
  platform_fee: "Taxa da plataforma",
  owner_direct: "Recebido direto pelo proprietário",
};

export type PayoutAdjustment = {
  id: string; reservation_id: string; reservation_code: string | null; competence: string;
  field: PayoutAmountField; previous_cents: number | null; previous_missing: boolean; new_cents: number;
  reason: string; created_by_name: string | null; created_at: string;
};

/** Dupla verificação: o banco só grava se `confirm` for idêntico a `amounts`; cada mudança vira histórico imutável. */
export async function adjustPayoutAmounts(reservationId: string, amounts: Partial<Record<PayoutAmountField, number>>, confirm: Partial<Record<PayoutAmountField, number>>, reason: string) {
  const { data, error } = await (getSupabaseBrowserClient() as any).rpc("admin_adjust_payout_amounts", {
    _reservation_id: reservationId, _amounts: amounts, _confirm_amounts: confirm, _reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as { changed: number };
}

export async function listPayoutAdjustments(implementationId: string): Promise<PayoutAdjustment[]> {
  const { data, error } = await (getSupabaseBrowserClient() as any).from("payout_reservation_adjustments")
    .select("id,reservation_id,reservation_code,competence,field,previous_cents,previous_missing,new_cents,reason,created_by_name,created_at")
    .eq("implementation_id", implementationId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as PayoutAdjustment[];
}
