import { describe, expect, it } from "vitest";

import {
  isContactValid,
  PROPOSAL_BLOCKS,
  proposalNumberChoice,
  reviewPropertySummary,
  summarize,
  toJourneyStep,
  validateContact,
} from "./opportunity-journey";

describe("jornada da nova oportunidade", () => {
  it("exige título, nome e telefone", () => {
    expect(isContactValid({ title: "", name: "", phone: "" })).toBe(false);
    expect(
      Object.keys(validateContact({ title: "Ve", name: "Bruna", phone: "51996262235" })),
    ).toEqual(["title"]);
    expect(
      validateContact({ title: "Vêneto A201", name: "Bruna", phone: "123" }).phone,
    ).toBeTruthy();
    expect(
      isContactValid({ title: "Vêneto A201", name: "Bruna Haupenthal", phone: "(51) 99626-2235" }),
    ).toBe(true);
  });

  it("mapeia etapas antigas", () => {
    expect(toJourneyStep("proprietario")).toBe("contato");
    expect(toJourneyStep("faltantes")).toBe("implantacao");
    expect(toJourneyStep("inventario")).toBe("implantacao");
    expect(toJourneyStep("condicoes")).toBe("proposta");
    expect(toJourneyStep("revisao")).toBe("revisao");
    expect(toJourneyStep("xyz")).toBeUndefined();
  });

  it("resume preenchidos e pendentes", () => {
    const r = summarize([
      { label: "a", value: "x" },
      { label: "b", value: "" },
      { label: "c", value: null },
    ]);
    expect(r.filled).toHaveLength(1);
    expect(r.missing).toBe(2);
  });

  it("mantém exatamente três blocos na proposta", () => {
    expect(PROPOSAL_BLOCKS).toEqual(["commercial", "preparation", "contract"]);
  });

  it("retoma presets, outro e a definir sem criar campos paralelos", () => {
    expect(proposalNumberChoice(12, [12, 24])).toBe("12");
    expect(proposalNumberChoice("60", [30, 60])).toBe("60");
    expect(proposalNumberChoice(18, [12, 24])).toBe("outro");
    expect(proposalNumberChoice(null, [12, 24])).toBe("tbd");
  });

  it("resume o imóvel sem listar cada campo ausente", () => {
    expect(
      reviewPropertySummary({
        condominium_name: "Vêneto",
        tower: "A",
        unit: "201",
        address: "",
        city: "Gramado",
        property_type: "apartamento",
        bedrooms: "2",
        capacity: "4",
      }),
    ).toEqual({ identification: "Vêneto · A · 201", missing: 0 });
    expect(
      reviewPropertySummary({
        condominium_name: "",
        tower: "",
        unit: "",
        address: "",
        city: "",
        property_type: "",
        bedrooms: "",
        capacity: "",
      }),
    ).toEqual({ identification: "Sem identificação", missing: 6 });
  });
});
