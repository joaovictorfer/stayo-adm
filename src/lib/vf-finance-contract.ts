import { z } from "zod";

export const statementQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  property: z.string().trim().min(1).max(120).optional(),
}).strict();

export const operationalExpenseSchema = z.object({
  event_type: z.literal("operational_expense.upserted"),
  event_id: z.string().min(1).max(120),
  idempotency_key: z.string().min(1).max(120),
  timestamp: z.string().datetime({ offset: true }),
  data: z.object({
    external_id: z.string().min(1).max(120),
    kind: z.enum(["ordem_servico", "limpeza", "manutencao", "despesa_operacional"]),
    description: z.string().max(500).optional(),
    property: z.object({ external_id: z.string().min(1).max(120), name: z.string().max(200).optional() }).strict(),
    supplier: z.object({ name: z.string().min(1).max(200) }).strict().optional(),
    competence: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    due_date: z.string().date(),
    amount: z.number().finite().min(0).max(100000000),
    cancelled: z.boolean().default(false),
  }).strict(),
}).strict();

const amount = z.number().finite();
export const statementResponseSchema = z.object({
  status: z.literal("ok"), month: z.string(), currency: z.literal("BRL"),
  properties: z.array(z.object({
    property: z.string(),
    revenue: z.object({ reservations: z.number(), gross_amount: amount, channel_fees: amount, cleaning_fees: amount, net_amount: amount }),
    deductions: z.object({ total: amount, by_kind: z.record(amount), items: z.array(z.object({ external_id: z.string(), kind: z.string(), amount })) }),
    net_payout: amount,
  })),
  totals: z.object({ net_revenue: amount, deductions: amount, net_payout: amount }),
});

export function statementPath(input: z.infer<typeof statementQuerySchema>) {
  const query = new URLSearchParams({ month: input.month });
  if (input.property) query.set("property", input.property);
  return `/api/public/stayo-statements?${query}`;
}

export function expensesTransmissionAllowed(enabled: string | undefined, confirmed: boolean) {
  return enabled === "true" && confirmed === true;
}