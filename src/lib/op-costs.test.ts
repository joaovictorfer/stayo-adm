import { describe, expect, it } from "vitest";
import { computeOpCosts, splitAmount, type CostExpense, type CostTask } from "./op-costs";

const task = (o: Partial<CostTask>): CostTask => ({ id: "t", title: "Limpeza", dueDate: "2026-11-10", status: "concluida", amount: 160, propertyId: "p1", propertyName: "A201", team: [{ staffId: "s1", name: "Leandro", share: 100 }], ...o });
const exp = (o: Partial<CostExpense>): CostExpense => ({ id: "e", date: "2026-11-11", amount: 40, status: "aprovado", propertyId: "p1", propertyName: "A201", staffId: "s1", staffName: "Leandro", ...o });

describe("custos operacionais", () => {
  it("divide valor pela equipe e fecha centavos", () => expect(splitAmount(100, [33.33, 33.33, 33.34])).toEqual([33.33, 33.33, 33.34]));
  it("divisão 50/50 de R$ 160", () => expect(splitAmount(160, [50, 50])).toEqual([80, 80]));
  it("só conta tarefas concluídas do mês", () => {
    const r = computeOpCosts([task({}), task({ status: "pendente" }), task({ dueDate: "2026-10-30" })], [], "2026-11");
    expect(r.services).toBe(160); expect(r.tasksDone).toBe(1);
  });
  it("a pagar = serviços + reembolsos aprovados; pendente e recusado não entram", () => {
    const r = computeOpCosts([task({})], [exp({}), exp({ status: "pendente", amount: 25 }), exp({ status: "recusado", amount: 99 })], "2026-11");
    expect(r.people[0]!.toPay).toBe(200); expect(r.pendingApproval).toBe(25); expect(r.expenses).toBe(65);
  });
  it("tarefa sem valor é sinalizada, não vira zero", () => {
    const r = computeOpCosts([task({ amount: null })], [], "2026-11");
    expect(r.unpriced).toBe(1); expect(r.services).toBe(0);
  });
  it("custo por imóvel soma serviços e gastos", () => {
    const r = computeOpCosts([task({})], [exp({})], "2026-11");
    expect(r.properties[0]!.total).toBe(200);
  });
});
