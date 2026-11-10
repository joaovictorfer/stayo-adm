import { describe, expect, it } from "vitest";
import { isPayoutPropertyEligible, matchesPayoutPropertySearch } from "./payout-properties";

describe("Payout property eligibility", () => {
  it("excludes properties still in implementation even when linked", () => {
    expect(isPayoutPropertyEligible({ status: "em_implantacao", core_property_id: "guia-property" })).toBe(false);
  });
  it("excludes properties not linked to the Guia", () => {
    expect(isPayoutPropertyEligible({ status: "ativo", core_property_id: null })).toBe(false);
    expect(isPayoutPropertyEligible({ status: "ativo", core_property_id: " " })).toBe(false);
  });
  it("includes active linked properties even if the selected month has no reservations", () => {
    expect(isPayoutPropertyEligible({ status: "ativo", core_property_id: "guia-property" })).toBe(true);
  });
});

it("finds units and accented names with a combined search", () => {
  const property = { code: "IMP-00019", nickname: "VE-C203", condominium_name: "Vêneto", unit: "C203" };
  expect(matchesPayoutPropertySearch(property, "veneto c203")).toBe(true);
  expect(matchesPayoutPropertySearch(property, "VE-C203")).toBe(true);
  expect(matchesPayoutPropertySearch(property, "Ravena")).toBe(false);
});