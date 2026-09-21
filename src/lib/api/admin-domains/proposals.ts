import type { ImplementationTemplate, ImplementationTemplateInput, ImplementationTemplatePayload, ProposalContentBlock, ProposalContentBlockInput, ProposalContentBlockPatch, ProposalSettings, ProposalSettingsInput } from "../../../types/proposal-config";
import { emptyTemplatePayload } from "../../../types/proposal-config";

export interface AdminProposalsDomain {
  proposalSettings: { get(implementationId: string): Promise<ProposalSettings | null>; save(implementationId: string, input: ProposalSettingsInput): Promise<ProposalSettings> };
  proposalBlocks: { listByImplementation(implementationId: string): Promise<ProposalContentBlock[]>; add(input: ProposalContentBlockInput): Promise<ProposalContentBlock>; update(id: string, patch: ProposalContentBlockPatch): Promise<ProposalContentBlock>; remove(id: string): Promise<void> };
  implementationTemplates: { list(): Promise<ImplementationTemplate[]>; get(id: string): Promise<ImplementationTemplate | null>; create(input: ImplementationTemplateInput): Promise<ImplementationTemplate>; remove(id: string): Promise<void> };
}
export interface ProposalSettingsRow { implementation_id: string; validity_days: number; payment_notes: string | null; updated_at: string }
export const proposalSettingsFromRow = (row: ProposalSettingsRow): ProposalSettings => ({ implementationId: row.implementation_id, validityDays: row.validity_days, paymentNotes: row.payment_notes, updatedAt: row.updated_at });
export interface ProposalBlockRow { id: string; implementation_id: string; title: string; body: string; visibility: ProposalContentBlock["visibility"]; display_order: number; created_at: string }
export const proposalBlockFromRow = (row: ProposalBlockRow): ProposalContentBlock => ({ id: row.id, implementationId: row.implementation_id, title: row.title, body: row.body, visibility: row.visibility, displayOrder: row.display_order, createdAt: row.created_at });
export interface ImplementationTemplateRow { id: string; name: string; notes: string | null; payload: unknown; created_at: string }
export const implementationTemplateFromRow = (row: ImplementationTemplateRow): ImplementationTemplate => ({ id: row.id, name: row.name, notes: row.notes, payload: { ...emptyTemplatePayload, ...((row.payload as Partial<ImplementationTemplatePayload> | null) ?? {}) }, createdAt: row.created_at });
