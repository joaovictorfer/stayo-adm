import { computeStatement, type StatementExpense, type StatementReservation, type StatementTransfer } from "./payout-statement";

/** Prazo de repasse STAYO: dia 10 do mês seguinte à competência (AAAA-MM). */
export function payoutDueDate(competence: string) {
  const y = Number(competence.slice(0, 4)), m = Number(competence.slice(5, 7));
  return new Date(Date.UTC(y, m, 10)).toISOString().slice(0, 10);
}

export type ClosingState = "incompleto" | "a_repassar" | "ok";
export interface ClosingRow { implementationId: string; state: ClosingState; balance: number; missing: number }

/** Lembrete do fechamento: deriva saldos pelo mesmo computeStatement do relatório, nunca grava. */
export function payoutClosingSummary(
  competence: string,
  ids: string[],
  fees: Record<string, number>,
  reservations: (StatementReservation & { implementation_id: string })[],
  expenses: (StatementExpense & { implementation_id: string })[],
  transfers: (StatementTransfer & { implementation_id: string })[],
): ClosingRow[] {
  return ids.map((id) => {
    const s = computeStatement(competence, fees[id] ?? 20,
      reservations.filter((r) => r.implementation_id === id),
      expenses.filter((e) => e.implementation_id === id),
      transfers.filter((t) => t.implementation_id === id));
    const state: ClosingState = s.incompleteCount > 0 ? "incompleto" : s.balance > 0 ? "a_repassar" : "ok";
    return { implementationId: id, state, balance: s.balance, missing: s.incompleteCount };
  });
}
