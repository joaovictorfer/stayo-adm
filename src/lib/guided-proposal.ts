import { PROPOSAL_ITEM_TEMPLATES, type ProposalItemTemplate } from "../config/proposal-item-templates";
import type { ProposalItem } from "../types/core";
import type {
  CommercialProposalVersion,
  ProposalDraftInput,
  ProposalItemOption,
} from "../types/commercial-proposal";

const cleanScope = (scope: string[] | undefined) =>
  (scope ?? []).map((entry) => entry.trim()).filter(Boolean);

const templateForItem = (item: { description: string }) =>
  PROPOSAL_ITEM_TEMPLATES.find(
    (template) => template.description.toLocaleLowerCase("pt-BR") === item.description.trim().toLocaleLowerCase("pt-BR"),
  );

export function optionFromTemplate(template: ProposalItemTemplate): ProposalItemOption {
  return {
    description: template.description,
    quantity: 1,
    unitValue: template.unitValue,
    discount: 0,
    included: true,
    optional: false,
    templateKey: template.key,
    details: template.details,
    scope: [...template.scope],
    pricing: "fixed",
  };
}

function optionFromItem(item: ProposalItem): ProposalItemOption {
  const template = templateForItem(item);
  return {
    description: item.description,
    quantity: item.quantity,
    unitValue: item.unitValue,
    discount: item.discount,
    included: true,
    optional: false,
    templateKey: template?.key ?? null,
    details: item.details ?? template?.details ?? "",
    scope: item.scope ?? template?.scope ?? [],
    pricing: item.pricing ?? "fixed",
  };
}

/** Mantém a cópia editável já salva; versões antigas caem para os itens congelados. */
export function guidedOptionsFromVersion(version: CommercialProposalVersion | null): ProposalItemOption[] {
  if (!version) return [];
  if (version.draftItemOptions?.length) {
    return version.draftItemOptions.map((option) => ({
      ...option,
      details: option.details ?? "",
      scope: [...(option.scope ?? [])],
    }));
  }
  const items = version.status === "draft" ? version.items : (version.snapshot?.items ?? version.items);
  return items.map(optionFromItem);
}

export function includedProposalItems(options: ProposalItemOption[]): ProposalItem[] {
  return options
    .filter((option) => option.included && option.description.trim())
    .map((option) => {
      const quantity = Math.max(0, Number(option.quantity) || 0);
      const unitValue = Math.max(0, Number(option.unitValue) || 0);
      const gross = quantity * unitValue;
      const discount = Math.min(Math.max(0, Number(option.discount) || 0), gross);
      return {
        description: option.description.trim(),
        quantity,
        unitValue,
        discount,
        total: Math.max(0, gross - discount),
        details: option.details?.trim() || null,
        scope: cleanScope(option.scope),
        pricing: option.pricing ?? "fixed",
      };
    });
}

export function guidedProposalIssue(options: ProposalItemOption[]): string | null {
  return includedProposalItems(options).length > 0 ? null : "Falta adicionar ao menos um serviço.";
}

export function buildGuidedDraftInput(input: {
  implementationId: string;
  version: CommercialProposalVersion | null;
  options: ProposalItemOption[];
  commandId: string;
}): ProposalDraftInput {
  const { implementationId, version, options, commandId } = input;
  const snapshot = version?.snapshot;
  return {
    proposalId: version?.status === "draft" ? version.id : null,
    implementationId,
    expectedRevision: version?.status === "draft" ? version.draftRevision : null,
    items: includedProposalItems(options),
    itemOptions: options.map((option) => ({
      ...option,
      description: option.description.trim(),
      details: option.details?.trim() || null,
      scope: cleanScope(option.scope),
    })),
    partnershipObject: version?.draftPartnershipObject ?? snapshot?.partnershipObject ?? null,
    responsibilities: version?.draftResponsibilities ?? snapshot?.responsibilities ?? [],
    requiredSignatories: version?.requiredSignatories ?? snapshot?.requiredSignatories ?? [],
    commandId,
  };
}

export function proposalServiceSummary(options: ProposalItemOption[]) {
  const included = options.filter((option) => option.included && option.description.trim());
  return {
    count: included.length,
    labels: included.map((option) => option.description.trim()),
  };
}