import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildPayoutPix, receiptMime, receiptLimit } from "./payout-pix";
import type { PayoutPaymentRequest } from "@/types/core";
import { validateReceiptDocument } from "./pdf/payout-receipt-pdf";

const selection = z.object({ implementationId: z.string().uuid(), competence: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
export const preparePayoutPayment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => selection.parse(input)).handler(async ({ data, context }) => {
  setResponseHeader("Cache-Control", "no-store");
  const { data: row, error } = await context.supabase.rpc("admin_prepare_payout", { p_implementation_id: data.implementationId, p_competence: data.competence });
  if (error) throw new Error(error.message);
  const request = row as unknown as PayoutPaymentRequest;
  const code = buildPayoutPix(request.snapshot.recipient, Number(request.amount_cents), request.id);
  return { request, code };
});
export const finalizePayoutPayment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: FormData) => {
  if (!(input instanceof FormData)) throw new Error("Comprovante obrigatório.");
  const file = input.get("file");
  if (!(file instanceof File) || !file.size || file.size > receiptLimit) throw new Error("Envie comprovante de até 10 MB.");
  return { ...z.object({ requestId: z.string().uuid(), amount: z.coerce.number().int().positive(), paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), confirmed: z.literal("true") }).parse(Object.fromEntries(input)), file };
}).handler(async ({ data, context }) => {
  setResponseHeader("Cache-Control", "no-store");
  const { data: allowed } = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "finance"] });
  if (allowed !== true) throw new Error("Acesso financeiro restrito.");
  const { data: request, error } = await context.supabase.from("payout_payment_requests").select("id,implementation_id,transfer_id,created_by").eq("id", data.requestId).single();
  if (error || !request || request.created_by !== context.userId) throw new Error("Repasse indisponível.");
  if (request.transfer_id) return { transferId: request.transfer_id };
  const bytes = new Uint8Array(await data.file.arrayBuffer());
  const mime = receiptMime(bytes);
  try { await validateReceiptDocument(bytes, mime); } catch { throw new Error("Comprovante corrompido ou protegido. Envie PDF, JPG ou PNG legível."); }
  const path = `${request.implementation_id}/${request.id}/receipt`;
  // Privileged storage writes are confined to validated financial evidence; reads remain user-scoped.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("payout-receipts");
  const { error: uploadError } = await bucket.upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    const { data: latest } = await context.supabase.from("payout_payment_requests").select("transfer_id").eq("id",request.id).single();
    if (latest?.transfer_id) return { transferId: latest.transfer_id };
    throw new Error("Comprovante não salvo. Aguarde e atualize o histórico antes de tentar novamente.");
  }
  const { data: transferId, error: saveError } = await context.supabase.rpc("admin_finalize_payout", { p_request_id: request.id, p_amount: data.amount, p_paid_on: data.paidOn, p_path: path, p_name: data.file.name.slice(0,200), p_mime: mime, p_size: bytes.length });
  if (saveError) { await bucket.remove([path]); throw new Error(saveError.message); }
  return { transferId };
});
export const listPayoutReceipts = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => selection.parse(input)).handler(async ({ data, context }) => {
  setResponseHeader("Cache-Control", "no-store");
  const { data: allowed } = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "finance"] });
  if (allowed !== true) throw new Error("Acesso financeiro restrito.");
  const { data: rows, error } = await context.supabase.from("payout_payment_requests").select("id,transfer_id,receipt_path,receipt_name,receipt_mime").eq("implementation_id", data.implementationId).eq("competence", data.competence).not("transfer_id", "is", null).order("created_at");
  if (error) throw new Error("Não foi possível consultar comprovantes.");
  return Promise.all(rows.map(async row => {
    if (!row.receipt_path) throw new Error("Comprovante ausente.");
    const { data: url, error } = await context.supabase.storage.from("payout-receipts").createSignedUrl(row.receipt_path, 300);
    if (error) throw new Error("Não foi possível abrir comprovante.");
    return { id: row.id, transferId: row.transfer_id, name: row.receipt_name ?? "Comprovante", mime: row.receipt_mime ?? "application/pdf", url: url.signedUrl };
  }));
});