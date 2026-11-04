import type { CentralReservation, CentralCheckin } from "./provider-contracts";
import type { CentralStatement } from "./statement";
import type { LocalAccessSnapshot } from "./access";
export const rid = "11111111-1111-4111-8111-111111111111";
export const pid = "22222222-2222-4222-8222-222222222222";
export const oid = "33333333-3333-4333-8333-333333333333";
export const meta = { request_id: "synthetic-request", generated_at: "2026-10-21T12:00:00Z", api_version: "1.0.0", has_more: false, next_cursor: null };
export function reservationFixture(): CentralReservation {
  return { id: rid, property_id: pid, reservation_code: "SYNTHETIC", channel: "direct", source_channel: null, external_reservation_id: null, external_reservation_code: null, checkin_date: "2020-01-01", checkout_date: "2020-01-03", guest_name: "Titular sintético", status: "confirmed", web_checkin_status: null, block_reason: null, block_purpose: null, cancelled_at: null, cancel_reason_code: null, created_at: null, updated_at: "2020-01-01T00:00:00Z", nights: 2, adults: 1, children: 0, infants: 0, is_block: false };
}
export function accessFixture(): LocalAccessSnapshot {
  return { userId: "synthetic-admin", adminAllowed: true, sensitiveAllowed: true, projects: [{ id: "local-project", owner_id: "local-owner", core_owner_id: oid, core_property_id: pid, status: "ativo" }], owners: [{ id: "local-owner", core_owner_id: oid }] };
}
export function statementFixture(): CentralStatement {
  const money = () => ({ cents: 0, currency: "BRL" as const, origin: "real" as const, source: "synthetic_fixture", reliability: "confirmed" as const });
  return { reservation: { id: rid, reservation_code: "SYNTHETIC", channel: "direct", checkin_date: "2020-01-01", checkout_date: "2020-01-03", reservation_status: "confirmed", adults: 1, children: 0, infants: 0 }, property: { id: pid, code: "SYN", name: "Imóvel sintético", city: "Gramado" }, owners: [{ owner_id: oid, owner_name: "Proprietário sintético", ownership_percent: 17, role: "owner" }], owners_basis: "current_property_registration", titular_guest: { status: "resolved", name: "Titular sintético" }, finance: { status: "available", receivable_status: "pending", gross: { ...money(), cents: 100001 }, platform_fee: money(), cleaning: money(), stayo_admin: money(), stayo_total: { ...money(), cents: 19317 }, owner_economic_value: { ...money(), cents: 80684 }, owner_economic_value_note: "Parcela econômica não é comprovante de repasse." }, updated_at: "2026-10-21T12:00:00Z" };
}
export function checkinFixture(): CentralCheckin {
  return { reservation_id: rid, web_checkin_status: null, submitted_at: null, reviewed_at: null, occupancy_confirmation_status: null, guests_registered: 1, guests_pending: 0, guests: [{ id: "synthetic-guest", name: "Titular sintético", document_type: "cpf", selfie_status: null, review_status: null, invite_status: null, sort_index: 0, is_primary: true }], titular: { titular_status: "resolved", guest_id: "synthetic-guest", document_status: "valid_cpf", document: "529.982.247-25", document_visibility: "sensitive_scope" } };
}