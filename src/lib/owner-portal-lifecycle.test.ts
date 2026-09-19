import { describe, expect, it } from "vitest";

import { availableOwnerPortalModules, ownerPortalStage } from "./owner-portal-lifecycle";
import type { OwnerPortalSnapshot } from "../types/owner-portal";

const snapshot = (status: OwnerPortalSnapshot["status"], corePropertyId: string | null): OwnerPortalSnapshot => ({
  mode: "implementation",
  ownerFirstName: "Victor",
  ownerName: "Victor",
  ownerPhone: null,
  ownerEmail: null,
  propertyLabel: "Vêneto G304",
  status,
  corePropertyId,
  coreOwnerId: null,
  activationDate: null,
  startDateEstimate: null,
  completionDateEstimate: null,
  visibleProgress: { done: 0, total: 0, percent: 0 },
  tasks: [],
  updates: [{ id: "history", title: "Histórico preservado", completedAt: "2026-09-19T00:00:00Z" }],
  proposal: null,
  transition: null,
  operations: null,
  refreshedAt: "2026-09-19T00:00:00Z",
});

describe("ownerPortalStage", () => {
  it("mantém implantação antes da prontidão", () => {
    expect(ownerPortalStage("em_implantacao", null)).toBe("implementation");
  });

  it("mostra transição quando está pronto", () => {
    expect(ownerPortalStage("pronto_para_operacao", null)).toBe("ready");
  });

  it("só ativa módulos operacionais após conversão oficial", () => {
    expect(ownerPortalStage("ativo", null)).toBe("ready");
    expect(ownerPortalStage("ativo", "property-1")).toBe("active");
  });

  it("preserva histórico e libera reservas apenas no estágio ativo", () => {
    const before = snapshot("em_implantacao", null);
    const after = { ...before, status: "ativo" as const, corePropertyId: "property-1" };
    expect(availableOwnerPortalModules(before)).not.toContain("reservations");
    expect(availableOwnerPortalModules(after)).toContain("reservations");
    expect(after.updates).toEqual(before.updates);
  });
});