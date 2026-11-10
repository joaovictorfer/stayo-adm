/**
 * Balancete mensal de repasse (valores em centavos).
 * - Repasse automático pela plataforma (ex.: Airbnb split): só informativo; saldo STAYO zero.
 * - Reservas recebidas pela STAYO: bruto − taxa da plataforma − limpeza − administração.
 * - Despesas do mês cobradas do proprietário e repasses já feitos são descontados.
 */
export type PayoutFlow = "platform_auto" | "stayo";
export interface StatementReservation { payout_flow: PayoutFlow; checkin_date: string; gross_cents: number; cleaning_cents: number; platform_fee_cents: number; owner_direct_cents: number; missing_amounts?: string[] | null }
export interface StatementExpense { occurred_on: string; amount_cents: number; charged_to_owner: boolean }
export interface StatementTransfer { competence: string; amount_cents: number }

/** Competência = mês do check-in (AAAA-MM). */
export const competenceOf = (date: string) => date.slice(0, 7);
export function previousCompetence(today = new Date()) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

export function computeStatement(
  competence: string,
  adminFeePercent: number,
  reservations: StatementReservation[],
  expenses: StatementExpense[],
  transfers: StatementTransfer[],
) {
  const inMonth = reservations.filter((r) => competenceOf(r.checkin_date) === competence);
  const auto = inMonth.filter((r) => r.payout_flow === "platform_auto");
  const stayo = inMonth.filter((r) => r.payout_flow === "stayo");
  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

  const autoGross = sum(auto, (r) => r.gross_cents);
  const autoOwnerDirect = sum(auto, (r) => r.owner_direct_cents);
  const stayoGross = sum(stayo, (r) => r.gross_cents);
  const platformFees = sum(stayo, (r) => r.platform_fee_cents);
  const cleaning = sum(stayo, (r) => r.cleaning_cents);
  /** Administração calculada por reserva (diárias líquidas × %) para o relatório fechar coluna a coluna. */
  const adminFee = sum(stayo, (r) => Math.round((Math.max(0, r.gross_cents - r.cleaning_cents - r.platform_fee_cents) * adminFeePercent) / 100));
  const ownerShare = stayoGross - platformFees - cleaning - adminFee;
  const expenseTotal = sum(expenses.filter((e) => e.charged_to_owner && competenceOf(e.occurred_on) === competence), (e) => e.amount_cents);
  const transferred = sum(transfers.filter((t) => t.competence === competence), (t) => t.amount_cents);
  const balance = ownerShare - expenseTotal - transferred;
  /** Reservas STAYO com valor ausente no Guia: o saldo é provisório, não definitivo. */
  const incompleteCount = stayo.filter((r) => (r.missing_amounts?.length ?? 0) > 0).length;
  const autoIncompleteCount = auto.filter((r) => r.missing_amounts?.includes("gross")).length;
  return {
    incompleteCount, autoIncompleteCount, complete: incompleteCount === 0,
    autoCount: auto.length, autoGross, autoOwnerDirect,
    stayoCount: stayo.length, stayoGross, platformFees, cleaning, adminFee, ownerShare,
    expenseTotal, transferred, balance,
    /** a_repassar: STAYO deve; a_compensar: proprietário deve; zerado. */
    status: balance > 0 ? "a_repassar" : balance < 0 ? "a_compensar" : "zerado",
  } as const;
}
