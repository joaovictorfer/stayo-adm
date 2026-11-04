import { z } from "zod";
import { adminStatementMoneySchema, providerEnvelope } from "./provider-contracts";

// OpenAPI nested objects are incomplete. This explicit projection is verified
// against both handoffs and App c5e2b1e0 src/lib/api-v1/admin-statement.ts.
const text = z.string().nullable();
export const statementSchema = z.object({
  reservation: z.object({ id: z.string().uuid(), reservation_code: text, channel: text, checkin_date: text, checkout_date: text, reservation_status: text, adults: z.number().nullable(), children: z.number().nullable(), infants: z.number().nullable() }),
  property: z.object({ id: z.string().uuid(), code: text, name: text, city: text }).nullable(),
  owners: z.array(z.object({ owner_id: z.string().uuid(), owner_name: text, ownership_percent: z.number().nullable(), role: text })),
  owners_basis: z.literal("current_property_registration"),
  titular_guest: z.object({ status: z.enum(["resolved", "missing", "ambiguous"]), name: text }),
  finance: z.object({ status: z.enum(["available", "unavailable"]), receivable_status: text, gross: adminStatementMoneySchema, platform_fee: adminStatementMoneySchema, cleaning: adminStatementMoneySchema, stayo_admin: adminStatementMoneySchema, stayo_total: adminStatementMoneySchema, owner_economic_value: adminStatementMoneySchema, owner_economic_value_note: z.string() }),
  updated_at: text,
}).superRefine((s, ctx) => {
  if (s.finance.status === "unavailable" && financialFields.some(k => s.finance[k].cents !== null)) ctx.addIssue({ code: "custom", message: "Unavailable finance must retain null amounts" });
});
export const statementEnvelope = providerEnvelope(statementSchema);
export type CentralStatement = z.infer<typeof statementSchema>;
export const financialFields = ["gross", "platform_fee", "cleaning", "stayo_admin", "stayo_total", "owner_economic_value"] as const;
export const moneyLabels = { gross: "Valor bruto", platform_fee: "Taxa da plataforma", cleaning: "Limpeza", stayo_admin: "Administração STAYO", stayo_total: "Parcela STAYO", owner_economic_value: "Parcela econômica do proprietário" };
export const originLabels = { real: "Origem observada", manual: "Valor manual", estimated: "Valor estimado", missing: "Valor indisponível", indeterminate: "Origem indeterminada" };
export const reliabilityLabels = { confirmed: "Fonte confirmada", pending_reconciliation: "Conciliação pendente", unavailable: "Indisponível" };
export function presentStatement(s: CentralStatement) {
  return {
    reservation: s.reservation, property: s.property,
    titular: s.titular_guest.status === "resolved" ? s.titular_guest.name : null,
    titularStatus: s.titular_guest.status, updatedAt: s.updated_at,
    rows: financialFields.map(key => ({ key, label: moneyLabels[key], ...s.finance[key] })),
    payoutConfirmed: false as const,
    warnings: [s.finance.owner_economic_value_note, "Proprietários conforme cadastro atual; não comprova titularidade ou rateio histórico.", ...(s.finance.status === "unavailable" ? ["Demonstrativo financeiro indisponível."] : [])],
  };
}