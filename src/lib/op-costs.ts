/**
 * Custos operacionais derivados (Fase 4): serviços = tarefas concluídas × divisão da equipe;
 * reembolsos = lançamentos não recusados. Nada é gravado; repasses e financeiro VF não são tocados.
 * Competência = mês da data prevista da tarefa / data do gasto.
 */
export interface CostTask { id: string; title: string; dueDate: string; status: string; amount: number | null; propertyId: string | null; propertyName: string | null; team: { staffId: string; name: string; share: number }[] }
export interface CostExpense { id: string; date: string; amount: number; status: "pendente" | "aprovado" | "pago" | "recusado"; propertyId: string | null; propertyName: string | null; staffId: string | null; staffName: string | null }

const cents = (v: number) => Math.round(v * 100) / 100;
export const inMonth = (iso: string, month: string) => iso.slice(0, 7) === month;

/** Divide o valor pelos percentuais, ajustando centavos no último para fechar o total exato. */
export function splitAmount(amount: number, shares: number[]): number[] {
  if (!shares.length) return [];
  const total = shares.reduce((s, x) => s + x, 0) || 1;
  const parts = shares.map((s) => cents((amount * s) / total));
  parts[parts.length - 1] = cents(amount - parts.slice(0, -1).reduce((s, x) => s + x, 0));
  return parts;
}

export interface PersonCost { key: string; name: string; services: number; tasks: number; reimbPending: number; reimbApproved: number; reimbPaid: number; toPay: number }
export interface PropertyCost { key: string; name: string; services: number; expenses: number; total: number; tasks: number }

export function computeOpCosts(tasks: CostTask[], expenses: CostExpense[], month: string) {
  const done = tasks.filter((t) => t.status === "concluida" && inMonth(t.dueDate, month));
  const exps = expenses.filter((e) => e.status !== "recusado" && inMonth(e.date, month));
  const people = new Map<string, PersonCost>();
  const props = new Map<string, PropertyCost>();
  const person = (key: string, name: string) => people.get(key) ?? people.set(key, { key, name, services: 0, tasks: 0, reimbPending: 0, reimbApproved: 0, reimbPaid: 0, toPay: 0 }).get(key)!;
  const prop = (key: string | null, name: string | null) => { const k = key ?? "none"; return props.get(k) ?? props.set(k, { key: k, name: name ?? "Sem imóvel", services: 0, expenses: 0, total: 0, tasks: 0 }).get(k)!; };
  let unpriced = 0;
  for (const t of done) {
    const p = prop(t.propertyId, t.propertyName); p.tasks += 1;
    if (t.amount == null) { unpriced += 1; continue; }
    p.services = cents(p.services + t.amount);
    if (!t.team.length) { const n = person("none", "Sem equipe"); n.services = cents(n.services + t.amount); n.tasks += 1; continue; }
    splitAmount(t.amount, t.team.map((m) => m.share)).forEach((v, i) => { const m = t.team[i]!; const n = person(m.staffId, m.name); n.services = cents(n.services + v); n.tasks += 1; });
  }
  for (const e of exps) {
    const p = prop(e.propertyId, e.propertyName); p.expenses = cents(p.expenses + e.amount);
    const n = person(e.staffId ?? "none", e.staffName ?? "Sem equipe");
    if (e.status === "pendente") n.reimbPending = cents(n.reimbPending + e.amount);
    if (e.status === "aprovado") n.reimbApproved = cents(n.reimbApproved + e.amount);
    if (e.status === "pago") n.reimbPaid = cents(n.reimbPaid + e.amount);
  }
  // A pagar = serviços + reembolsos aprovados (pendentes aguardam aprovação; pagos já foram quitados).
  for (const n of people.values()) n.toPay = cents(n.services + n.reimbApproved);
  for (const p of props.values()) p.total = cents(p.services + p.expenses);
  const services = cents(done.reduce((s, t) => s + (t.amount ?? 0), 0));
  const expTotal = cents(exps.reduce((s, e) => s + e.amount, 0));
  return {
    services, expenses: expTotal, total: cents(services + expTotal), tasksDone: done.length, unpriced,
    pendingApproval: cents(exps.filter((e) => e.status === "pendente").reduce((s, e) => s + e.amount, 0)),
    people: [...people.values()].sort((a, b) => b.toPay - a.toPay),
    properties: [...props.values()].sort((a, b) => b.total - a.total),
  };
}
