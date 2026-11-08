import { describe, expect, it } from "vitest";
import { computeStatement, previousCompetence } from "./payout-statement";

const r = (o: Partial<Parameters<typeof computeStatement>[2][number]>) => ({ payout_flow: "stayo" as const, checkin_date: "2026-10-05", gross_cents: 0, cleaning_cents: 0, platform_fee_cents: 0, owner_direct_cents: 0, ...o });

describe("balancete de repasse", () => {
  it("só Airbnb com repasse automático deixa o saldo zerado", () => {
    const s = computeStatement("2026-10", 20, [r({ payout_flow: "platform_auto", gross_cents: 420000, owner_direct_cents: 336000 })], [], []);
    expect(s.balance).toBe(0);
    expect(s.status).toBe("zerado");
    expect(s.autoOwnerDirect).toBe(336000);
  });
  it("reserva direta: desconta limpeza e 20% de administração sobre a diária", () => {
    const s = computeStatement("2026-10", 20, [r({ gross_cents: 125000, cleaning_cents: 25000 })], [], []);
    expect(s.adminFee).toBe(20000);
    expect(s.balance).toBe(80000);
    expect(s.status).toBe("a_repassar");
  });
  it("despesa do mês e repasse já feito reduzem o saldo", () => {
    const s = computeStatement("2026-10", 20, [r({ gross_cents: 125000, cleaning_cents: 25000 })], [{ occurred_on: "2026-10-14", amount_cents: 15000, charged_to_owner: true }], [{ competence: "2026-10", amount_cents: 30000 }]);
    expect(s.balance).toBe(35000);
  });
  it("despesa sem reserva STAYO vira saldo a compensar", () => {
    const s = computeStatement("2026-10", 20, [], [{ occurred_on: "2026-10-02", amount_cents: 20000, charged_to_owner: true }], []);
    expect(s.balance).toBe(-20000);
    expect(s.status).toBe("a_compensar");
  });
  it("ignora lançamentos de outros meses", () => {
    const s = computeStatement("2026-10", 20, [r({ checkin_date: "2026-09-30", gross_cents: 99900 })], [{ occurred_on: "2026-11-01", amount_cents: 500, charged_to_owner: true }], []);
    expect(s.balance).toBe(0);
  });
  it("competência padrão é o mês anterior", () => {
    expect(previousCompetence(new Date("2026-11-08T12:00:00Z"))).toBe("2026-10");
    expect(previousCompetence(new Date("2026-01-03T12:00:00Z"))).toBe("2025-12");
  });
});
