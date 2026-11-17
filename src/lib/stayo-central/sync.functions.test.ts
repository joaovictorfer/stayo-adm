import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./http.server", () => ({ createCentralHttp: () => ({ get: mocks.get }) }));

import { syncCentralReservations } from "./sync.functions";

const projectId = "11111111-1111-4111-8111-111111111111";
const propertyId = "22222222-2222-4222-8222-222222222222";
const reservationId = "33333333-3333-4333-8333-333333333333";
const syntheticCpf = "529.982.247-25";
let localRows: Record<string, unknown>[] = [];
let lastDelete: ReturnType<typeof vi.fn> | null = null;

async function sync(titular: Record<string, unknown>, existing = true, statementOk = true) {
  const deleteRow = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  lastDelete = deleteRow;
  const writes = { update: vi.fn((_row: Record<string, unknown>) => ({ eq: vi.fn(async () => ({ error: null })) })), insert: vi.fn(async (_row: Record<string, unknown>) => ({ error: null })) };
  const supabase = {
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from: (table: string) => {
      if (table === "implementation_projects") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: projectId, core_property_id: propertyId }, error: null }) }) }) };
      if (table === "implementation_contract_conditions") return { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { payout_mode: "platform_auto" } }) }) }) }) };
      return { ...writes, delete: deleteRow, select: () => ({ in: async () => ({ data: existing ? [{ central_reservation_id: reservationId }] : [] }), eq: () => ({ not: () => ({ gte: () => ({ lt: async () => ({ data: localRows }) }) }) }) }) };
    },
  };
  mocks.get.mockImplementation(async (path: string) => path.endsWith("/statement")
    ? { ok: statementOk, data: { data: { titular_guest: titular, finance: { status: "available", gross: { cents: 250000 }, cleaning: { cents: 30000 }, platform_fee: { cents: 0 } } } } }
    : { ok: true, data: { data: { items: [{ id: reservationId, property_id: propertyId, status: "confirmed", channel: "airbnb", guest_name: "Titular sintético", checkin_date: "2026-10-07", checkout_date: "2026-10-15" }], page: { has_more: false } } } });
  const handler = syncCentralReservations as unknown as (input: unknown) => Promise<unknown>;
  await handler({ context: { supabase, userId: "synthetic-admin" }, data: { implementationId: projectId, month: "2026-10" } });
  return (existing ? writes.update : writes.insert).mock.calls[0]?.[0] as Record<string, unknown> | undefined;
}

describe("Central reservation CPF import", () => {
  beforeEach(() => { localRows = []; vi.clearAllMocks(); vi.stubEnv("STAYO_API_TOKEN", "synthetic-test-token"); });

  it("updates an existing reservation with the resolved titular CPF", async () => {
    expect(await sync({ status: "resolved", name: "Titular sintético", cpf: syntheticCpf })).toMatchObject({ guest_cpf: "52998224725", gross_cents: 250000, cleaning_cents: 30000 });
  });

  it("marks missing individual payment instead of retaining a real-looking zero", async () => {
    expect(await sync({ status: "resolved" })).toMatchObject({ owner_direct_cents: 0, missing_amounts: ["owner_direct"] });
  });

  it("imports the titular CPF on new reservations without changing payout routing", async () => {
    expect(await sync({ status: "resolved", cpf: syntheticCpf }, false)).toMatchObject({ guest_cpf: "52998224725", payout_flow: "platform_auto" });
  });

  it.each([{}, { status: "resolved", cpf: null }, { status: "resolved", cpf: "" }, { status: "ambiguous", cpf: syntheticCpf }, { status: "missing", cpf: syntheticCpf }, { status: "resolved", cpf: "00000000000" }])("does not erase a saved CPF for unavailable or invalid titular data: %j", async (titular) => {
    expect(await sync(titular)).not.toHaveProperty("guest_cpf");
  });

  it("preserves a saved CPF when the provider statement request fails", async () => {
    expect(await sync({ status: "resolved", cpf: syntheticCpf }, true, false)).not.toHaveProperty("guest_cpf");
  });
  it("removes imported reservations no longer valid in the Guide, keeping manually adjusted ones", async () => {
    localRows = [
      { id: "r-valid", central_reservation_id: reservationId, manual_amounts: [] },
      { id: "r-cancelled", central_reservation_id: "cancelled-id", manual_amounts: [] },
      { id: "r-manual", central_reservation_id: "moved-id", manual_amounts: ["gross"] },
    ];
    await sync({});
    expect(lastDelete).toHaveBeenCalledTimes(1);
    const eq = lastDelete!.mock.results[0]!.value.eq;
    expect(eq).toHaveBeenCalledWith("id", "r-cancelled");
  });
});

describe("monthsFrom", () => {
  it("covers the current month and the next ones across the year", async () => {
    const { monthsFrom } = await import("./sync.functions");
    expect(monthsFrom("2026-11-17", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});
