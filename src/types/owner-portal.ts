import type { ImplementationItemStatus, ImplementationStatus } from "./core";

export type OwnerPortalStage = "implementation" | "ready" | "active";

export type OwnerPortalModule =
  | "overview"
  | "implementation"
  | "profile"
  | "proposal"
  | "reservations"
  | "calendar"
  | "property"
  | "inspections"
  | "maintenance"
  | "financial"
  | "documents";

export interface OwnerPortalReservationView {
  id: string;
  checkin: string;
  checkout: string;
  propertyName: string;
  channel: string | null;
  status: string;
  guestCount: number | null;
  amount: number | null;
}

export interface OwnerPortalInspectionView {
  id: string;
  type: string;
  scheduledAt: string | null;
  status: string;
  summary: string | null;
}

export interface OwnerPortalMaintenanceView {
  id: string;
  title: string;
  status: string;
  openedAt: string;
  summary: string | null;
}

export interface OwnerPortalFinancialView {
  id: string;
  kind: "statement" | "payout" | "expense";
  reference: string;
  amount: number | null;
  status: string;
  documentAvailable: boolean;
}

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
  acceptedName: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unitValue: number;
    discount: number;
    total: number;
  }>;
}

export interface OwnerPortalSnapshot {
  /** Compatibilidade com convites existentes; o estágio real é derivado por status + corePropertyId. */
  mode: "implementation" | "active";
  ownerFirstName: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  propertyLabel: string;
  status: ImplementationStatus;
  corePropertyId?: string | null;
  coreOwnerId?: string | null;
  activationDate?: string | null;
  startDateEstimate: string | null;
  completionDateEstimate: string | null;
  visibleProgress: { done: number; total: number; percent: number };
  tasks: OwnerPortalTaskView[];
  updates: OwnerPortalUpdateView[];
  proposal: OwnerPortalProposalView | null;
  transition?: {
    initialInspection: "pending" | "scheduled" | "completed" | "unavailable";
    guestConfiguration: "pending" | "in_progress" | "completed" | "unavailable";
    channels: string[];
  } | null;
  operations?: {
    reservations: OwnerPortalReservationView[];
    inspections: OwnerPortalInspectionView[];
    maintenance: OwnerPortalMaintenanceView[];
    financial: OwnerPortalFinancialView[];
  } | null;
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