import { describe, expect, it } from "vitest";

import {
  buildGuidedDraftInput,
  guidedOptionsFromVersion,
  guidedProposalIssue,
  includedProposalItems,
  optionFromTemplate,
  proposalServiceSummary,
} from "./guided-proposal";
import { PROPOSAL_ITEM_TEMPLATES } from "../config/proposal-item-templates";
import type { CommercialProposalVersion } from "../types/commercial-proposal";

const version = (patch: Partial<CommercialProposalVersion> = {}): CommercialProposalVersion => ({
  id: "proposal-1",
  implementationId: "implementation-1",
  version: 1,
  status: "draft",
  items: [],
  total: 0,
  draftResponsibilities: ["STAYO: Preparar o anúncio"],
  requiredSignatories: [{ label: "Titular", role: "Proprietário titular" }],
  draftItemOptions: [],
  draftPartnershipObject: "Objeto preservado",
  snapshot: null,
  draftRevision: 3,
  publishedAt: null,
  publishedBy: null,
  acceptedAt: null,
  acceptedName: null,
  createdAt: "2026-09-27T00:00:00.000Z",
  updatedAt: "2026-09-27T00:00:00.000Z",
  ...patch,
});

describe("proposta guiada", () => {
  it("cria uma cópia independente do modelo oficial", () => {
    const option = optionFromTemplate(PROPOSAL_ITEM_TEMPLATES[0]!);
    option.scope?.push("Alteração local");
    expect(PROPOSAL_ITEM_TEMPLATES[0]?.scope).not.toContain("Alteração local");
  });

  it("preserva opções personalizadas e dados avançados do rascunho", () => {
    const options = [
      { ...optionFromTemplate(PROPOSAL_ITEM_TEMPLATES[0]!), unitValue: 725 },
      {
        description: "Serviço especial",
        quantity: 1,
        unitValue: 90,
        discount: 0,
        included: false,
        optional: true,
      },
    ];
    const current = version({ draftItemOptions: options });
    expect(guidedOptionsFromVersion(current)).toEqual(
      options.map((item) => ({
        ...item,
        details: item.details ?? "",
        scope: item.scope ?? [],
      })),
    );

    const input = buildGuidedDraftInput({
      implementationId: "implementation-1",
      version: current,
      options,
      commandId: "command-1",
    });
    expect(input.items).toHaveLength(1);
    expect(input.items[0]?.unitValue).toBe(725);
    expect(input.itemOptions).toHaveLength(2);
    expect(input.partnershipObject).toBe("Objeto preservado");
    expect(input.responsibilities).toEqual(["STAYO: Preparar o anúncio"]);
    expect(input.requiredSignatories).toHaveLength(1);
  });

  it("aponta precisamente a ausência do serviço obrigatório", () => {
    expect(guidedProposalIssue([])).toBe("Falta adicionar ao menos um serviço.");
    expect(guidedProposalIssue([optionFromTemplate(PROPOSAL_ITEM_TEMPLATES[0]!)])).toBeNull();
  });

  it("calcula apenas serviços selecionados", () => {
    const selected = optionFromTemplate(PROPOSAL_ITEM_TEMPLATES[0]!);
    const excluded = { ...optionFromTemplate(PROPOSAL_ITEM_TEMPLATES[1]!), included: false };
    expect(includedProposalItems([selected, excluded])).toHaveLength(1);
    expect(proposalServiceSummary([selected, excluded])).toEqual({
      count: 1,
      labels: ["Implantação"],
    });
  });
});
