import { describe, expect, it } from "vitest";
import { expensesTransmissionAllowed, operationalExpenseSchema, statementPath, statementQuerySchema } from "./vf-finance-contract";

describe("VF Financeiro", () => {
  it("does not activate transmissions without explicit activation and confirmation", () => {
    expect(expensesTransmissionAllowed(undefined, true)).toBe(false);
    expect(expensesTransmissionAllowed("true", false)).toBe(false);
    expect(expensesTransmissionAllowed("true", true)).toBe(true);
  });
  it("validates month and encodes property filter", () => {
    expect(statementQuerySchema.safeParse({ month: "2026-13" }).success).toBe(false);
    expect(statementPath({ month: "2026-10", property: "casa & 1" })).toBe("/api/public/stayo-statements?month=2026-10&property=casa+%26+1");
  });
  it("rejects guest information and preserves reais and idempotency", () => {
    const expense = { event_type: "operational_expense.upserted", event_id: "evt-123", idempotency_key: "os-987-v2", timestamp: "2026-10-17T10:00:00-03:00", data: { external_id: "os-987", kind: "limpeza", property: { external_id: "casa-1" }, competence: "2026-10", due_date: "2026-10-20", amount: 150.5 } };
    const parsed = operationalExpenseSchema.parse(expense);
    expect(parsed.data.amount).toBe(150.5);
    expect(parsed.idempotency_key).toBe("os-987-v2");
    expect(operationalExpenseSchema.safeParse({ ...expense, data: { ...expense.data, guest: { cpf: "unwanted" } } }).success).toBe(false);
  });
});