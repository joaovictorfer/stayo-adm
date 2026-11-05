import { describe, expect, it } from "vitest";
import { compareProperty, decideLink, matchesQuery, requiresAppLink } from "./property-link";

const app = { id: "a", name: "Ravena B406", code: "RAV-B406", address: "Rua Garibaldi 100", city: "Gramado", linkedToCode: null };

describe("vínculo com o STAYO APP", () => {
  it("Ativo exige vínculo; Validação não", () => {
    expect(requiresAppLink("ativo")).toBe(true);
    expect(requiresAppLink("validacao")).toBe(false);
  });
  it("unidade já vinculada a outra ficha é bloqueada mesmo confirmando", () => {
    expect(decideLink({ currentCoreId: null, candidateId: "a", linkedToOtherCode: "IMP-00002", differences: 0, acknowledged: true })).toEqual({ ok: false, reason: "linked_elsewhere" });
  });
  it("dados diferentes pedem confirmação explícita", () => {
    expect(decideLink({ currentCoreId: null, candidateId: "a", linkedToOtherCode: null, differences: 1, acknowledged: false })).toEqual({ ok: false, reason: "needs_ack" });
    expect(decideLink({ currentCoreId: null, candidateId: "a", linkedToOtherCode: null, differences: 1, acknowledged: true })).toEqual({ ok: true });
  });
  it("compara condomínio, unidade e endereço", () => {
    const same = compareProperty({ condominium: "Ravena", unit: "B406", address: "Rua Garibaldi, 100" }, app);
    expect(same.filter((r) => r.differs)).toHaveLength(0);
    const diff = compareProperty({ condominium: "Vêneto", unit: "D306", address: "Av. Borges 1" }, app);
    expect(diff.filter((r) => r.differs).map((r) => r.key)).toEqual(["condominium", "unit", "address"]);
  });
  it("busca ignora acentos e exige todos os termos", () => {
    expect(matchesQuery(app, "ravena b406")).toBe(true);
    expect(matchesQuery(app, "veneto")).toBe(false);
  });
});
