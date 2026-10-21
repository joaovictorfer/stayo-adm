import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader, getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { hashToken } from "./api/token-hash";
import { amountFor, buildOrder, payerSchema } from "./charge-payments";

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
type Item = { id: string; description: string; quantity: number; unitCents: number };
export type PaymentView = { method: "pix" | "card"; amountCents: number; status: string; qrCode: string | null; qrCodeUrl: string | null; checkoutUrl: string | null; expiresAt: string | null } | null;

async function loadContext(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: charge } = await supabaseAdmin.from("stayo_charges").select("id,snapshot,state,expires_at,revoked_at,paid_at").eq("token_hash", await hashToken(token)).maybeSingle();
  if (!charge || charge.state !== "open" || charge.revoked_at || !charge.expires_at || new Date(charge.expires_at) <= new Date()) throw new Error("Link indisponível.");
  return { db: supabaseAdmin, charge };
}
async function pagarmeKey(db: Awaited<ReturnType<typeof loadContext>>["db"]) {
  const secret = process.env["STAYO_CREDENTIAL_ENCRYPTION_KEY"];
  const { data } = await db.from("pagarme_settings_vault").select("encrypted_key").eq("id", "sandbox").maybeSingle();
  if (!secret || !data) throw new Error("Pagamento indisponível no momento.");
  const { decryptCredential } = await import("./pagarme-settings/vault.server");
  return decryptCredential(data.encrypted_key, secret);
}
async function pagarme(key: string, path: string, body?: unknown) {
  const r = await fetch(`https://api.pagar.me/core/v5${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Basic ${btoa(`${key}:`)}`, Accept: "application/json", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
  const json = await r.json().catch(() => null) as Record<string, any> | null;
  if (!r.ok || !json) { console.error("pagarme", path.split("/")[1], r.status, JSON.stringify(json?.errors ?? json?.message ?? "").slice(0, 400)); throw new Error("A Pagar.me não aceitou o pedido. Confira os dados e tente novamente."); }
  return json;
}
const view = (p: any): PaymentView => p ? { method: p.method, amountCents: p.amount_cents, status: p.status, qrCode: p.qr_code, qrCodeUrl: p.qr_code_url, checkoutUrl: p.checkout_url, expiresAt: p.expires_at } : null;

export const startChargePayment = createServerFn({ method: "POST" })
  .inputValidator(input => z.object({ token: tokenSchema, method: z.enum(["pix", "card"]), payer: payerSchema }).parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { db, charge } = await loadContext(data.token);
    if (charge.paid_at) throw new Error("Esta cobrança já foi paga.");
    const snap = charge.snapshot as { code: string; items: Item[] };
    const amount = amountFor(snap.items, data.method);
    const { data: existing } = await db.from("stayo_charge_payments").select("*").eq("charge_id", charge.id).eq("method", data.method).eq("status", "pending").gt("expires_at", new Date(Date.now() + 120000).toISOString()).eq("amount_cents", amount).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing) return view(existing);
    const key = await pagarmeKey(db);
    const origin = new URL(getRequest().url).origin;
    const order = await pagarme(key, "/orders", buildOrder({ code: snap.code, method: data.method, amount, payer: data.payer, chargeId: charge.id, successUrl: `${origin}/cobranca/${data.token}` }));
    if (order.amount !== amount && data.method === "pix") throw new Error("Valor divergente; pagamento não iniciado.");
    const tx = order.charges?.[0]?.last_transaction;
    const row = {
      charge_id: charge.id, method: data.method, amount_cents: amount, provider_order_id: String(order.id),
      status: order.status === "failed" || tx?.status === "failed" ? "failed" : "pending",
      qr_code: tx?.qr_code ?? null, qr_code_url: tx?.qr_code_url ?? null, checkout_url: order.checkouts?.[0]?.payment_url ?? null,
      expires_at: tx?.expires_at ?? order.checkouts?.[0]?.expires_at ?? new Date(Date.now() + 3600000).toISOString(),
    };
    const { data: saved, error } = await db.from("stayo_charge_payments").insert(row).select("*").single();
    if (error) throw new Error("Não foi possível registrar o pagamento.");
    if (row.status === "failed") throw new Error("A Pagar.me recusou a criação do pagamento. Confira os dados.");
    return view(saved);
  });

/** Confirma pagamento consultando a Pagar.me pela API autenticada; retorno do navegador não é comprovante. */
export const checkChargePayment = createServerFn({ method: "POST" })
  .inputValidator(input => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { db, charge } = await loadContext(data.token);
    if (charge.paid_at) return { paid: true, payment: null as PaymentView };
    const { data: pending } = await db.from("stayo_charge_payments").select("*").eq("charge_id", charge.id).eq("status", "pending").order("created_at", { ascending: false }).limit(5);
    if (!pending?.length) return { paid: false, payment: null as PaymentView };
    const key = await pagarmeKey(db);
    for (const p of pending) {
      if (!p.provider_order_id) continue;
      const order = await pagarme(key, `/orders/${encodeURIComponent(p.provider_order_id)}`).catch(() => null);
      if (!order) continue;
      const paidAmount = order.charges?.[0]?.paid_amount;
      if (order.status === "paid" && paidAmount === p.amount_cents && order.metadata?.stayo_charge_id === charge.id) {
        await db.from("stayo_charge_payments").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", p.id);
        await db.from("stayo_charges").update({ paid_at: new Date().toISOString(), paid_method: p.method, paid_amount_cents: p.amount_cents }).eq("id", charge.id).is("paid_at", null);
        return { paid: true, payment: null as PaymentView };
      }
      if (order.status === "canceled" || order.status === "failed") await db.from("stayo_charge_payments").update({ status: order.status, updated_at: new Date().toISOString() }).eq("id", p.id);
    }
    return { paid: false, payment: view(pending[0]) };
  });
