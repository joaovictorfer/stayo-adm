import { z } from "zod";
import { chargeTotals } from "./charge-prototype";

export const payerSchema = z.object({
  name: z.string().trim().min(3).max(64),
  document: z.string().transform(v => v.replace(/\D/g, "")).refine(v => v.length === 11 || v.length === 14, "CPF ou CNPJ inválido"),
  phone: z.string().transform(v => v.replace(/\D/g, "")).refine(v => v.length === 10 || v.length === 11, "Celular com DDD inválido"),
  email: z.string().trim().email().max(64),
}).strict();
export type Payer = z.infer<typeof payerSchema>;

/** Valor cobrado é sempre derivado dos itens publicados: Pix integral, cartão +5%. */
export function amountFor(items: { quantity: number; unitCents: number; id: string; description: string }[], method: "pix" | "card") {
  const t = chargeTotals(items);
  return method === "pix" ? t.pix : t.card;
}

export function buildOrder(opts: { code: string; method: "pix" | "card"; amount: number; payer: Payer; successUrl: string; chargeId: string }) {
  const { payer } = opts;
  const customer = {
    name: payer.name, email: payer.email, document: payer.document,
    type: payer.document.length === 14 ? "company" : "individual",
    document_type: payer.document.length === 14 ? "CNPJ" : "CPF",
    phones: { mobile_phone: { country_code: "55", area_code: payer.phone.slice(0, 2), number: payer.phone.slice(2) } },
  };
  const payment = opts.method === "pix"
    ? { payment_method: "pix", pix: { expires_in: 3600 } }
    : { payment_method: "checkout", amount: opts.amount, checkout: { expires_in: 60, accepted_payment_methods: ["credit_card"], success_url: opts.successUrl, customer_editable: false, billing_address_editable: true, skip_checkout_success_page: false, credit_card: { installments: [{ number: 1, total: opts.amount }] } } };
  return {
    code: `${opts.code}-${opts.method}`.slice(0, 52),
    items: [{ amount: opts.amount, description: `${opts.code} · ${opts.method === "pix" ? "Pix" : "Cartão (+5%)"}`, quantity: 1, code: opts.code }],
    customer, payments: [payment], metadata: { stayo_charge_id: opts.chargeId },
  };
}
