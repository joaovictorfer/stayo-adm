import { describe, it, expect } from 'vitest';
import { canRevealOwnerGuestCpf, ownerMonthProjection, ownerReservationProjection } from './owner-workspace';

const row = { id: 'r1', reservation_code: 'RSV-1', channel: 'direta', guest_name: 'Hóspede', guest_cpf: '12345678901', checkin_date: '2026-10-02', checkout_date: '2026-10-05', payout_flow: 'stayo' as const, gross_cents: 245000, cleaning_cents: 25000, platform_fee_cents: 0, owner_direct_cents: 0 };
describe('owner workspace publication', () => {
  it('uses the PDF split without exposing cleaning or a full CPF', () => {
    const r = ownerReservationProjection(row, 20);
    expect([r.total, r.stayo, r.owner]).toEqual([220000, 44000, 176000]);
    expect(r.cpfMasked).toBe('123.•••.•••-01');
    expect(JSON.stringify(r)).not.toContain('12345678901');
    expect(r).not.toHaveProperty('cleaning_cents');
  });
  it('uses each contract percentage', () => {
    const r = ownerReservationProjection(row, 15);
    expect([r.stayo, r.owner]).toEqual([33000, 187000]);
  });
  it('does not infer a payment from the Airbnb channel', () => {
    expect(ownerReservationProjection({ ...row, channel: 'airbnb' }, 20).directConfirmed).toBe(false);
    expect(ownerReservationProjection({ ...row, channel: 'airbnb', payout_flow: 'platform_auto', missing_amounts: ['owner_direct'] }, 20).directReceipt).toBeNull();
  });
  it('preserves a legitimate zero but marks missing amounts', () => {
    expect(ownerReservationProjection({ ...row, gross_cents: 0, cleaning_cents: 0 }, 20).total).toBe(0);
    expect(ownerReservationProjection({ ...row, missing_amounts: ['gross'] }, 20).total).toBeNull();
  });
  it('preserves closing amount after payment', () => {
    const m = ownerMonthProjection('2026-10', 20, [row], [], [{ competence: '2026-10', amount_cents: 176000 }]);
    expect(m.closingAmount).toBe(176000); expect(m.balance).toBe(0); expect(m.transferred).toBe(176000);
  });
  it('allows full CPF only for linked titular or coproprietario', () => {
    expect(canRevealOwnerGuestCpf('titular', true)).toBe(true);
    expect(canRevealOwnerGuestCpf('coproprietario', true)).toBe(true);
    expect(canRevealOwnerGuestCpf('representante_legal', true)).toBe(false);
    expect(canRevealOwnerGuestCpf('titular', false)).toBe(false);
    expect(canRevealOwnerGuestCpf(undefined, false)).toBe(false);
  });
});