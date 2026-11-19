import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (h: unknown) => h }; return b; } }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./http.server", () => ({ createCentralHttp: () => ({ get: mocks.get }) }));
import { readOperationalReservation } from "./operational-reservation.functions";
const invoke = readOperationalReservation as unknown as (input: unknown) => Promise<unknown>;
function context(allowed: boolean) { return { supabase: { rpc: async () => ({ data: allowed }), from: (table: string) => ({ select: () => ({ eq: () => ({ single: async () => ({ data: table === "payout_reservations" ? { central_reservation_id: "reservation-id", implementation_id: "local-property" } : { core_property_id: "property-id" } }) }) }) }) } }; }
describe("operational reservation read", () => {
  it("denies a caller without an authorized role before external reads", async () => { mocks.get.mockClear(); await expect(invoke({ context: context(false), data: { id: "local" } })).rejects.toThrow("Acesso restrito"); expect(mocks.get).not.toHaveBeenCalled(); });
  it("rejects an unrelated provider property", async () => { mocks.get.mockResolvedValue({ ok: true, data: { data: { id: "reservation-id", property_id: "other-property" } } }); await expect(invoke({ context: context(true), data: { id: "local" } })).rejects.toThrow("não correspondem"); });
  it("returns counts including legitimate zero without documents or money", async () => { mocks.get.mockResolvedValue({ ok: true, data: { data: { id: "reservation-id", property_id: "property-id", reservation_code: "RSV-1", adults: 2, children: 0, infants: null, web_checkin_status: "not_sent", status: "confirmed", nights: 3, document: "private", amount: 123 } } }); const result = await invoke({ context: context(true), data: { id: "local" } }); expect(result).toEqual({ code: "RSV-1", adults: 2, children: 0, infants: null, webCheckin: "not_sent", status: "confirmed", nights: 3 }); });
});