import { describe, expect, it } from "vitest";
import { payoutChannelGroups } from "./payout-channel-groups";
import type { PayoutPdfReservation } from "./pdf/payout-pdf";

const reservation = (channel: string, gross: number, flow: "stayo" | "platform_auto" = "stayo"): PayoutPdfReservation => ({
  channel, gross_cents: gross, payout_flow: flow, checkin_date: "2026-10-01", checkout_date: "2026-10-03", reservation_code: null,
  guest_name: "Hóspede Teste", guest_cpf: null, cleaning_cents: 0, platform_fee_cents: 0, owner_direct_cents: 0,
});

describe("channel subtotals", () => {
  it("keeps direct and Airbnb subtotals separate with the contractual 20/80 split", () => {
    const groups = payoutChannelGroups([reservation("direta", 220000), reservation("airbnb", 100000, "platform_auto"), reservation("airbnb", 50000)], 20);
    expect(groups[0]?.totals).toEqual({ base: 220000, stayo: 44000, owner: 176000 });
    expect(groups[1]?.totals).toEqual({ base: 150000, stayo: 30000, owner: 120000 });
    expect(groups[1]?.reservations.map(row => row.payout_flow)).toEqual(["platform_auto", "stayo"]);
  });
  it("respects the contractual 15/85 exception", () => {
    expect(payoutChannelGroups([reservation("direta", 100000)], 15)[0]?.totals).toEqual({ base: 100000, stayo: 15000, owner: 85000 });
  });
  it("does not present missing financial values as a confirmed zero subtotal", () => {
    expect(payoutChannelGroups([{ ...reservation("airbnb", 0), missing_amounts: ["gross"] }], 20)[1]?.complete).toBe(false);
    expect(payoutChannelGroups([reservation("airbnb", 0)], 20)[1]?.complete).toBe(true);
  });
  it("keeps other channels separate instead of labelling them as direct", () => {
    const groups = payoutChannelGroups([reservation("booking", 100000)], 20);
    expect(groups.find(group => group.channel === "direta")?.reservations).toHaveLength(0);
    expect(groups.find(group => group.channel === "booking")?.totals.base).toBe(100000);
  });
});