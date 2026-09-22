import { describe, expect, it } from "vitest";

import { getOwnerPortalModules, getOwnerPortalPhase } from "./owner-portal-lifecycle";

describe("owner portal lifecycle", () => {
  it("mantém o foco na implantação antes da prontidão", () => {
    expect(getOwnerPortalPhase({ status: "em_implantacao", corePropertyId: null })).toBe("implementation");
  });

  it("mostra transição quando está pronto, mas ainda não há imóvel oficial", () => {
    expect(getOwnerPortalPhase({ status: "pronto_para_operacao", corePropertyId: null })).toBe("ready");
    expect(getOwnerPortalPhase({ status: "ativo", corePropertyId: null })).toBe("ready");
  });

  it("libera operação apenas com status ativo e imóvel oficial", () => {
    const phase = getOwnerPortalPhase({ status: "ativo", corePropertyId: "property-1" });
    expect(phase).toBe("operation");
    expect(getOwnerPortalModules(phase)).toContain("reservations");
    expect(getOwnerPortalModules(phase)).toContain("finance");
  });
});