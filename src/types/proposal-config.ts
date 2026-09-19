/**
 * Fase 5 — configuração da proposta e modelos de implantação.
 *
 * As condições comerciais continuam em CommercialTerm (percentual, valor
 * fixo único, por reserva, mensal, opcional, informativo). Aqui ficam o
 * prazo de validade, as observações de pagamento e os blocos de regras /
 * observações, cada um com o destino em que pode aparecer.
 *
 * Modelo de implantação é SEMPRE snapshot: aplicar copia a configuração e
 * a implantação passa a ser independente do modelo de origem. O payload
 * nunca carrega dado pessoal de proprietário.
 */

export type ProposalBlockVisibility = "interno" | "proposta" | "portal";

export const proposalBlockVisibilityLabels: Record<ProposalBlockVisibility, string> = {
  interno: "Somente uso interno",
  proposta: "Proposta e PDF",
  portal: "Portal do proprietário",
};

export interface ProposalSettings {
  implementationId: string;
  validityDays: number;
  paymentNotes: string | null;
  updatedAt: string;
}

export interface ProposalSettingsInput {
  validityDays?: number;
  paymentNotes?: string | null;
}

export interface ProposalContentBlock {
  id: string;
  implementationId: string;
  title: string;
  body: string;
  visibility: ProposalBlockVisibility;
  displayOrder: number;
  createdAt: string;
}

export interface ProposalContentBlockInput {
  implementationId: string;
  title: string;
  body?: string;
  visibility?: ProposalBlockVisibility;
  displayOrder?: number;
}

export interface ProposalContentBlockPatch {
  title?: string;
  body?: string;
  visibility?: ProposalBlockVisibility;
  displayOrder?: number;
}

/** Snapshot de configuração — sem nome, telefone, e-mail ou documento. */
export interface ImplementationTemplatePayload {
  commercialTerms: Array<{
    label: string;
    chargeType: string;
    value: number;
    optional: boolean;
    displayOrder: number;
    notes: string | null;
  }>;
  blocks: Array<{
    title: string;
    body: string;
    visibility: ProposalBlockVisibility;
    displayOrder: number;
  }>;
  supplies: Array<{
    module: "enxoval" | "faltante";
    name: string;
    room: string | null;
    size: string | null;
    requiredQty: number;
    displayOrder: number;
  }>;
  validityDays: number | null;
  paymentNotes: string | null;
}

export const emptyTemplatePayload: ImplementationTemplatePayload = {
  commercialTerms: [],
  blocks: [],
  supplies: [],
  validityDays: null,
  paymentNotes: null,
};

export interface ImplementationTemplate {
  id: string;
  name: string;
  notes: string | null;
  payload: ImplementationTemplatePayload;
  createdAt: string;
}

export interface ImplementationTemplateInput {
  name: string;
  notes?: string | null;
  payload: ImplementationTemplatePayload;
}
