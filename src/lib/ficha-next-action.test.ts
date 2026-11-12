import { describe, expect, it } from "vitest";

import { nextAction, toFichaSection, type FichaState } from "./ficha-next-action";

const base: FichaState = {
  hasOwnerName: true,
  hasOwnerPhone: true,
  missingPropertyFields: 0,
  proposalStatus: "accepted",
  intakeSubmitted: true,
  pendingItems: 0,
  pendingBlockers: 0,
};

describe("próxima ação da ficha", () => {
  it("segue a ordem do fluxo", () => {
    expect(nextAction({ ...base, hasOwnerPhone: false }).section).toBe("proprietario");
    expect(nextAction({ ...base, proposalStatus: null }).title).toBe("Montar a proposta");
    expect(nextAction({ ...base, proposalStatus: "draft" }).title).toBe("Publicar proposta");
    expect(nextAction({ ...base, proposalStatus: "published" }).section).toBe("proposta");
    expect(nextAction({ ...base, intakeSubmitted: false }).section).toBe("proprietario");
    expect(nextAction({ ...base, pendingBlockers: 2 }).title).toContain("2 bloqueadores");
    expect(nextAction({ ...base, missingPropertyFields: 3 }).section).toBe("imovel");
    expect(nextAction(base).title).toBe("Tudo em dia");
  });
  it("ação comercial tem prioridade", () => {
    expect(nextAction({ ...base, proposalStatus: null, commercialAction: "Ligar" }).title).toBe("Ligar");
  });
  it("valida a seção", () => {
    expect(toFichaSection("portal")).toBe("proprietario");
    expect(toFichaSection("x")).toBeUndefined();
  });
  it("publicação direciona ao convite sem afirmar que o Portal está liberado", () => {
    expect(nextAction({ ...base, proposalStatus: "published" }).cta).toBe("Ver condições");
    expect(nextAction({ ...base, intakeSubmitted: false }).cta).toBe("Ver proprietário");
  });
});
