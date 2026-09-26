import { describe, expect, it } from "vitest";

import { isContactValid, summarize, toJourneyStep, validateContact } from "./opportunity-journey";

describe("jornada da nova oportunidade", () => {
  it("exige título, nome e telefone", () => {
    expect(isContactValid({ title: "", name: "", phone: "" })).toBe(false);
    expect(Object.keys(validateContact({ title: "Ve", name: "Bruna", phone: "51996262235" }))).toEqual([
      "title",
    ]);
    expect(validateContact({ title: "Vêneto A201", name: "Bruna", phone: "123" }).phone).toBeTruthy();
    expect(isContactValid({ title: "Vêneto A201", name: "Bruna Haupenthal", phone: "(51) 99626-2235" })).toBe(
      true,
    );
  });

  it("mapeia etapas antigas", () => {
    expect(toJourneyStep("proprietario")).toBe("contato");
    expect(toJourneyStep("faltantes")).toBe("implantacao");
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
});
