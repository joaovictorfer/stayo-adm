import { describe, expect, it } from "vitest";

import { generatePublishedProposalPdf } from "./proposal-pdf";
import type { CommercialProposalSnapshot } from "../../types/commercial-proposal";

const snapshot: CommercialProposalSnapshot = {
  schemaVersion: 1,
  proposalId: "00000000-0000-4000-8000-000000000701",
  implementationId: "00000000-0000-4000-8000-000000000901",
  version: 1,
  opportunity: {
    code: "IMP-TESTE",
    title: "Oportunidade de teste",
  },
  items: [
    {
      description: "Implantação",
      quantity: 1,
      unitValue: 1200,
      discount: 0,
      total: 1200,
    },
  ],
  total: 1200,
  commercialTerms: [
    {
      label: "Administração",
      chargeType: "percentage",
      value: 20,
      optional: false,
      displayOrder: 1,
      notes: null,
    },
  ],
  contractConditions: {
    administrationFee: 20,
    payoutRule: "Repasse mensal",
  },
  responsibilities: ["Configuração inicial dos canais"],
  content: [
    {
      title: "Como funciona",
      body: "Conteúdo publicado no snapshot.",
      displayOrder: 1,
    },
  ],
  requiredSignatories: [{ label: "Proprietário titular", role: "proprietário" }],
  publishedAt: "2026-09-24T18:00:00.000Z",
};

describe("generateProposalPdf", () => {
  it("gera um PDF usando apenas o snapshot publicado", async () => {
    const bytes = await generatePublishedProposalPdf({ snapshot });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
