import { describe, expect, it } from "vitest";
import { payoutClosingSummary, payoutDueDate } from "./payout-closing";

const res = (id: string, gross: number, missing: string[] = []) => ({ implementation_id: id, payout_flow: "stayo" as const, checkin_date: "2026-10-05", gross_cents: gross, cleaning_cents: 0, platform_fee_cents: 0, owner_direct_cents: 0, missing_amounts: missing });

describe("lembrete do dia 10", () => {
  it("prazo é dia 10 do mês seguinte, inclusive na virada do ano", () => {
    expect(payoutDueDate("2026-10")).toBe("2026-11-10");
    expect(payoutDueDate("2026-12")).toBe("2027-01-10");
  });
  it("saldo pendente aparece a repassar e some depois do repasse lançado", () => {
    const [a] = payoutClosingSummary("2026-10", ["a"], { a: 20 }, [res("a", 100000)], [], []);
    expect(a).toMatchObject({ state: "a_repassar", balance: 80000 });
    const [b] = payoutClosingSummary("2026-10", ["a"], { a: 20 }, [res("a", 100000)], [], [{ implementation_id: "a", competence: "2026-10", amount_cents: 80000 }]);
    expect(b?.state).toBe("ok");
  });
  it("reserva sem valor marca o imóvel como incompleto", () => {
    const [a] = payoutClosingSummary("2026-10", ["a"], {}, [res("a", 0, ["gross"])], [], []);
    expect(a?.state).toBe("incompleto");
  });
});
