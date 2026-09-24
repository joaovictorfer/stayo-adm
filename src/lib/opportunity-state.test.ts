import { describe, expect, it } from "vitest";

import { isLightOpportunity, opportunityNextAction, opportunityTitle } from "./opportunity-state";

const base = {
  status: "prospect" as const,
  condominiumId: null,
  condominiumName: null,
  unit: null,
  address: null,
  corePropertyId: null,
};

describe("opportunity state", () => {
  it("usa o título provisório antes dos dados do imóvel", () => {
    expect(
      opportunityTitle({ nickname: "Apartamento da Ana", condominiumName: null, unit: null, code: "IMP-00010" }),
    ).toBe("Apartamento da Ana");
  });

  it("mantém compatibilidade com implantações antigas sem nickname", () => {
    expect(
      opportunityTitle({ nickname: null, condominiumName: "Vêneto", unit: "302", code: "IMP-00010" }),
    ).toBe("Vêneto · 302");
  });

  it("identifica prospect sem imóvel como oportunidade leve", () => {
    expect(isLightOpportunity(base)).toBe(true);
    expect(opportunityNextAction(base)).toBe("Completar dados ou preparar proposta");
  });

  it("não trata implantação com condomínio como oportunidade vazia", () => {
    const value = { ...base, condominiumName: "Vêneto" };
    expect(isLightOpportunity(value)).toBe(false);
    expect(opportunityNextAction(value)).toBe("Preparar proposta");
  });

  it("deriva próxima ação sem marcar prospect como operacional", () => {
    expect(opportunityNextAction({ ...base, status: "proposta" })).toBe("Revisar proposta");
    expect(opportunityNextAction({ ...base, status: "ativo" })).toBe("Acompanhar operação");
  });
});
