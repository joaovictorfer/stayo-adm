import type { ImplementationItemStatus, ImplementationStatus } from "./core";

export interface OwnerPortalTaskView {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source: "owner_task" | "checklist";
}

export interface OwnerPortalUpdateView {
  id: string;
  title: string;
  completedAt: string;
}

export interface OwnerPortalProposalView {
  id: string;
  version: number;
  total: number;
  acceptedAt: string | null;
}

export interface OwnerPortalSnapshot {
  mode: "implementation";
  ownerFirstName: string;
  propertyLabel: string;
  status: ImplementationStatus;
  startDateEstimate: string | null;
  completionDateEstimate: string | null;
  visibleProgress: { done: number; total: number; percent: number };
  tasks: OwnerPortalTaskView[];
  updates: OwnerPortalUpdateView[];
  proposal: OwnerPortalProposalView | null;
  refreshedAt: string;
}

export interface OwnerPortalPublicAccess {
  expiresAt: string;
  revokedAt: string | null;
  snapshot: OwnerPortalSnapshot;
}

export interface OwnerPortalVisibleChecklistItem {
  id: string;
  title: string;
  description: string | null;
  status: ImplementationItemStatus;
  completedAt: string | null;
}