import { describe, expect, it } from "vitest";
import { conditionPendingIssues, conditionSections } from "./contract-conditions";

const flat = (c: Parameters<typeof conditionSections>[0]) =>
  Object.fromEntries(conditionSections(c).flatMap((s) => s.items.map((i) => [i.label, i.value])));

describe("quadro-resumo das condições", () => {
  it("R$ 250, uso sem limite, 7 dias, cessão permitida", () => {
    const f = flat({
      commercialCleaningFee: 250,
      ownerUseLimitMode: "unlimited",
      ownerUseNoticeDays: 7,
      assignmentMode: "allowed",
      assignmentNoticeDays: 7,
      initialCleaningOption: "stayo_post_construction",
      initialCleaningFee: 500,
    });
    expect(f["Limpeza comercial"]).toBe("R$ 250,00");
    expect(f["Limite de uso próprio"]).toBe("Sem limite contratual de dias");
    expect(f["Antecedência para pedir"]).toBe("7 dias antes");
    expect(f["Limpeza após o uso"]).toBe("R$ 250,00");
    expect(f["Limpeza após a cessão"]).toBe("R$ 250,00");
    expect(f["Cessão de uso"]).toBe("Permitida");
    const s = conditionSections({ ownerUseLimitMode: "unlimited" }).find((x) => x.key === "owner_use");
    expect(s?.note).toMatch(/reserva confirmada/);
  });
  it("R$ 300 com limite definido", () => {
    const f = flat({ commercialCleaningFee: 300, ownerUseLimitMode: "limited", ownerUseLimitDays: 30, ownerUseLimitPeriod: "por ano" });
    expect(f["Limite de uso próprio"]).toBe("Até 30 dias por ano");
    expect(f["Limpeza comercial"]).toBe("R$ 300,00");
  });
  it("valor indefinido nunca vira R$ 0,00 e fica pendente", () => {
    const c = { ownerUseLimitMode: "tbd" };
    const f = flat(c);
    expect(f["Limpeza comercial"]).toBe("Valor a definir");
    expect(Object.values(f).join()).not.toContain("R$ 0,00");
    expect(conditionPendingIssues(c).length).toBeGreaterThan(0);
  });
  it("pós-obra não vira limpeza comercial", () => {
    const f = flat({ initialCleaningOption: "stayo_post_construction", initialCleaningFee: 500 });
    expect(f["Limpeza comercial"]).toBeUndefined();
  });
});
