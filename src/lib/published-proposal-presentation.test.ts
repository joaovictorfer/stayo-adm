import { describe, expect, it } from "vitest";
import type { CommercialProposalSnapshot } from "../types/commercial-proposal";
import { publishedProposalPresentation } from "./published-proposal-presentation";

const snapshot = (pricing: "fixed" | "conditional", total: number): CommercialProposalSnapshot => ({
  schemaVersion: 1,
  proposalId: "proposal",
  implementationId: "implementation",
  version: 2,
  opportunity: { code: "IMP-TEST", title: null },
  items: [
    { description: "Implantação", quantity: 1, unitValue: 500, discount: 0, total: 500, pricing: "fixed" },
    { description: "Limpeza pós-obra", quantity: 1, unitValue: total, discount: 0, total, pricing },
  ],
  total: 500 + total,
  commercialTerms: [],
  contractConditions: {
    initialCleaningOption: "stayo_post_construction",
    initialCleaningCostBearer: "owner",
  },
  responsibilities: [],
  content: [],
  requiredSignatories: [],
  publishedAt: "2026-09-26T00:00:00.000Z",
});

describe("apresentação publicada da limpeza pós-obra", () => {
  it("repete o preço aprovado, informa o pagador e soma uma única vez", () => {
    const result = publishedProposalPresentation(snapshot("fixed", 400));
    expect(result.cleaningDecision).toMatchObject({ state: "defined" });
    expect(result.cleaningDecision?.price).toMatch(/400,00/);
    expect(result.cleaningDecision?.help).toContain("paga pelo proprietário");
    expect(result.groups.fixedTotal).toBe(900);
    expect(result.groups.fixed.filter((item) => /pós-obra/i.test(item.description))).toHaveLength(1);
    expect(result.groups.pending).toHaveLength(0);
  });

  it("oculta preço condicional e o retira do total definido", () => {
    const result = publishedProposalPresentation(snapshot("conditional", 400));
    expect(result.cleaningDecision).toMatchObject({ price: null, state: "quote" });
    expect(result.cleaningDecision?.help).toContain("Valor a definir após avaliação");
    expect(result.groups.fixedTotal).toBe(500);
    expect(result.groups.pending).toHaveLength(1);
    expect(result.groups.pending[0]?.total).toBe(0);
  });
});