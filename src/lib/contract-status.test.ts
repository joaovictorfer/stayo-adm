import { describe, expect, it } from "vitest";

import { contractsExpiringWithin } from "./contract-status";
import type { Contract } from "../types/core";

function contract(endDate: string | null): Contract {
  return {
    id: "1",
    code: "CTR-1",
    ownerId: "o1",
    ownerName: null,
    propertyId: null,
    propertyName: null,
    type: "gestao",
    status: "ativo",
    startDate: null,
    endDate,
    signedAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

describe("contractsExpiringWithin", () => {
  const now = new Date("2026-09-17T00:00:00.000Z");

  it("inclui contratos que vencem dentro da janela", () => {
    const result = contractsExpiringWithin([contract("2026-09-20T00:00:00.000Z")], 30, now);
    expect(result).toHaveLength(1);
  });

  it("ignora contratos sem data de término", () => {
    expect(contractsExpiringWithin([contract(null)], 30, now)).toHaveLength(0);
  });

  it("ignora contratos que já venceram", () => {
    expect(contractsExpiringWithin([contract("2026-09-01T00:00:00.000Z")], 30, now)).toHaveLength(
      0,
    );
  });

  it("ignora contratos que vencem além da janela", () => {
    expect(contractsExpiringWithin([contract("2027-01-01T00:00:00.000Z")], 30, now)).toHaveLength(
      0,
    );
  });
});
