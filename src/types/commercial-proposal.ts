import type { EntityId, ProposalItem } from "./core";

export type CommercialProposalStatus = "draft" | "published" | "accepted" | "superseded";

export interface ProposalSnapshotCommercialTerm {
  label: string;
  chargeType: string;
  value: number;
  optional: boolean;
  displayOrder: number;
  notes: string | null;
}

export interface ProposalSnapshotContractConditions {
  administrationFee?: number | null;
  cleaningResponsibility?: string | null;
  payoutRule?: string | null;
  maintenanceLimit?: number | null;
  exclusivity?: boolean | null;
  durationMonths?: number | null;
  noticePeriodDays?: number | null;
}

export interface ProposalSnapshotContentBlock {
  title: string;
  body: string;
  displayOrder: number;
}

export interface ProposalRequiredSignatory {
  label: string;
  role?: string | null;
}

export interface ProposalItemOption {
  description: string;
  quantity: number;
  unitValue: number;
  discount: number;
  included: boolean;
  optional: boolean;
}

export interface CommercialProposalSnapshot {
  schemaVersion: number;
  /** Aditivo (migration 0025). Ausente em versões anteriores. */
  partnershipObject?: string | null;
  proposalId: EntityId;
  implementationId: EntityId;
  version: number;
  opportunity: {
    code: string;
    title: string | null;
  };
  items: ProposalItem[];
  total: number;
  commercialTerms: ProposalSnapshotCommercialTerm[];
  contractConditions: ProposalSnapshotContractConditions;
  responsibilities: string[];
  content: ProposalSnapshotContentBlock[];
  requiredSignatories: ProposalRequiredSignatory[];
  publishedAt: string;
}

export interface CommercialProposalVersion {
  id: EntityId;
  implementationId: EntityId;
  version: number;
  status: CommercialProposalStatus;
  items: ProposalItem[];
  total: number;
  draftResponsibilities: string[];
  requiredSignatories: ProposalRequiredSignatory[];
  /** Presentes só quando a migration 0025 estiver aplicada (undefined antes). */
  draftItemOptions?: ProposalItemOption[] | undefined;
  draftPartnershipObject?: string | null | undefined;
  snapshot: CommercialProposalSnapshot | null;
  draftRevision: number;
  publishedAt: string | null;
  publishedBy: EntityId | null;
  acceptedAt: string | null;
  acceptedName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalDraftInput {
  proposalId?: EntityId | null;
  implementationId: EntityId;
  expectedRevision?: number | null;
  items: ProposalItem[];
  responsibilities: string[];
  requiredSignatories: ProposalRequiredSignatory[];
  /** Lista completa, com desligados. Ignorada pelo banco antes da 0025. */
  itemOptions?: ProposalItemOption[];
  partnershipObject?: string | null;
  commandId: string;
}
