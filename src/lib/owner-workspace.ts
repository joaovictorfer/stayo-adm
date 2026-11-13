import type { OwnerWorkspaceMonth, OwnerWorkspaceReservation } from '@/types/core';
import { payoutPdfBalance, payoutPdfSplit, type PayoutPdfReservation } from './pdf/payout-pdf';
import type { StatementExpense, StatementTransfer } from './payout-statement';

export function ownerReservationProjection(row: PayoutPdfReservation & { id: string }, fee: number): OwnerWorkspaceReservation {
  const split = payoutPdfSplit(row, fee);
  const complete = !row.missing_amounts?.some(k => ['gross', 'cleaning', 'platform_fee'].includes(k));
  const digits = row.guest_cpf?.replace(/\D/g, '') ?? '';
  const automatic = row.payout_flow === 'platform_auto';
  const confirmed = automatic && !row.missing_amounts?.includes('owner_direct');
  return {
    id: row.id, code: row.reservation_code ?? 'Sem código', channel: row.channel,
    guestName: row.guest_name, cpfMasked: digits.length === 11 ? `${digits.slice(0, 3)}.•••.•••-${digits.slice(-2)}` : null,
    checkin: row.checkin_date, checkout: row.checkout_date,
    total: complete ? split.base : null, stayo: complete ? split.stayo : null, owner: complete ? split.owner : null,
    directReceipt: confirmed ? row.owner_direct_cents : null,
    directConfirmed: confirmed && row.owner_direct_cents > 0,
  };
}

export function ownerMonthProjection(competence: string, fee: number, rows: (PayoutPdfReservation & { id: string })[], expenses: StatementExpense[], transfers: StatementTransfer[]): OwnerWorkspaceMonth {
  const input = { competence, adminFeePercent: fee, reservations: rows,
    expenses: expenses.map(e => ({ ...e, description: '', category: '' })),
    transfers: transfers.map(t => ({ ...t, paid_on: '', method: '' })) };
  const b = payoutPdfBalance(input);
  const reservations = rows.filter(r => r.checkin_date.slice(0, 7) === competence).map(r => ownerReservationProjection(r, fee));
  const complete = reservations.every(r => r.total !== null);
  return { competence, reservations, total: complete ? b.totalReservations : null,
    ownerTotal: complete ? b.totalOwner : null, airbnbReceived: b.airbnbReceived,
    expenses: b.statement.expenseTotal, transferred: b.statement.transferred,
    closingAmount: b.statement.complete ? b.closingAmount : null,
    balance: b.statement.complete ? b.statement.balance : null };
}

export function canRevealOwnerGuestCpf(role: string | undefined, linked: boolean): boolean {
  return linked && (role === 'titular' || role === 'coproprietario');
}