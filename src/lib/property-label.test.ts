import { describe, expect, it } from "vitest";
import { propertyLabel } from "./property-label";
describe("propertyLabel", () => {
  it("distingue H403 de I403 pelo apelido da ficha", () => {
    expect(propertyLabel({ nickname: "Vêneto H403", condominium_name: "Vêneto", unit: "403" })).toBe("Vêneto H403");
    expect(propertyLabel({ nickname: "Vêneto I403", condominium_name: "Vêneto", unit: "403" })).toBe("Vêneto I403");
  });
  it("sem apelido usa condomínio e unidade, depois o código", () => {
    expect(propertyLabel({ condominium_name: "Ravena", unit: "B406" })).toBe("Ravena B406");
    expect(propertyLabel({ code: "IMP-00001" })).toBe("IMP-00001");
  });
});
