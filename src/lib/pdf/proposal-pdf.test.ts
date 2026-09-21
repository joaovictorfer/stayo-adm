import { describe, expect, it } from "vitest";

import { generateProposalPdf } from "./proposal-pdf";
import type { ImplementationProject, Proposal } from "../../types/core";

const implementation: ImplementationProject = {
  id: "impl-1",
  code: "IMP-00001",
  status: "proposta",
  ownerId: "owner-1",
  ownerName: "Maria Teste",
  ownerPhone: "11999999999",
  coverImage: null,
  nickname: "Apto vista mar",
  condominiumName: "Residencial Sol",
  unit: "304",
  address: null,
  postalCode: null,
  city: "Florianópolis",
  propertyType: "Apartamento",
  bedrooms: 2,
  capacity: 4,
  responsibleUserId: null,
  startDateEstimate: null,
  completionDateEstimate: null,
  notes: null,
  origin: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  corePropertyId: null,
  coreOwnerId: null,
};

const proposal: Proposal = {
  id: "prop-1",
  implementationId: "impl-1",
  version: 1,
  items: [
    { description: "Implantação", quantity: 1, unitValue: 500, discount: 0, total: 500 },
    { description: "Limpeza pós-obra", quantity: 1, unitValue: 500, discount: 0, total: 500 },
  ],
  total: 1000,
  acceptedAt: null,
  acceptedName: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("generateProposalPdf", () => {
  it("gera bytes de PDF válidos (assinatura %PDF)", async () => {
    const bytes = await generateProposalPdf({
      implementation,
      proposal,
      recurringTerms: [
        {
          id: "t1",
          implementationId: "impl-1",
          label: "Taxa Stayo",
          chargeType: "percentage",
          value: 20,
          optional: false,
          displayOrder: 1,
          notes: null,
        },
      ],
      portalUrl: "https://stayo.example/portal/proposta/token123",
    });

    expect(bytes.length).toBeGreaterThan(500);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("funciona sem termos recorrentes e sem link de portal", async () => {
    const bytes = await generateProposalPdf({
      implementation,
      proposal,
      recurringTerms: [],
      portalUrl: null,
    });
    expect(bytes.length).toBeGreaterThan(500);
  });
});
