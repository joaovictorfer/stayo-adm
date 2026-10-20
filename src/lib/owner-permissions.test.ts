import { describe, expect, it } from "vitest";

import { maskOwnerDocument, ownerPortalPermissions } from "./owner-permissions";

describe("ownerPortalPermissions", () => {
  it("titular vê tudo, sem selo de cota", () => {
    expect(ownerPortalPermissions("titular")).toEqual({
      canViewFinance: true,
      canViewBankingData: true,
      canEditPropertyData: true,
      showFullDocument: true,
      showShareBadge: false,
    });
  });

  it("coproprietário vê tudo e exibe selo de cota", () => {
    const permissions = ownerPortalPermissions("coproprietario");
    expect(permissions.canViewFinance).toBe(true);
    expect(permissions.showShareBadge).toBe(true);
  });

  it("representante legal não vê financeiro, banco nem CPF completo e não edita imóvel", () => {
    expect(ownerPortalPermissions("representante_legal")).toEqual({
      canViewFinance: false,
      canViewBankingData: false,
      canEditPropertyData: false,
      showFullDocument: false,
      showShareBadge: false,
    });
  });
});

describe("maskOwnerDocument", () => {
  it("mantém só os 3 primeiros e 2 últimos dígitos do CPF", () => {
    expect(maskOwnerDocument("526.199.153-68")).toBe("526••••••68");
  });

  it("retorna null quando não há documento", () => {
    expect(maskOwnerDocument(null)).toBeNull();
    expect(maskOwnerDocument(undefined)).toBeNull();
  });

  it("nunca expõe documento curto", () => {
    expect(maskOwnerDocument("1234")).toBe("•••");
  });
});
