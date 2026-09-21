import type { OwnerOnboardingDraft, OwnerOnboardingLink, OwnerOnboardingSubmission, OwnerOnboardingSubmissionInput } from "../../../types/owner-onboarding";
import type { OwnerPortalPublicAccess, OwnerPortalSnapshot } from "../../../types/owner-portal";

export interface AdminOwnerPortalDomain {
  ownerOnboarding: {
    getLink(implementationId: string): Promise<OwnerOnboardingLink | null>;
    createLink(implementationId: string, ownerId: string | null, publicSnapshot: OwnerPortalSnapshot, validityDays?: number): Promise<{ link: OwnerOnboardingLink; token: string }>;
    revoke(id: string): Promise<OwnerOnboardingLink>;
    findByToken(token: string): Promise<OwnerOnboardingLink | null>;
    resolvePortal(token: string): Promise<OwnerPortalPublicAccess | null>;
    acceptPortalProposal(token: string, acceptedName: string): Promise<void>;
    getDraft(token: string): Promise<OwnerOnboardingDraft | null>;
    saveDraft(token: string, input: OwnerOnboardingDraft, submit?: boolean): Promise<OwnerOnboardingDraft>;
    getSubmission(implementationId: string): Promise<OwnerOnboardingSubmission | null>;
    submit(implementationId: string, token: string, input: OwnerOnboardingSubmissionInput): Promise<OwnerOnboardingSubmission>;
  };
}

export interface OwnerOnboardingLinkRow {
  id: string; implementation_id: string; owner_id: string | null; token_hash: string;
  created_at: string; created_by: string | null; expires_at: string; used_at: string | null;
  revoked_at: string | null; last_access_at: string | null; public_snapshot: OwnerPortalSnapshot | null;
}
export const ownerOnboardingLinkFromRow = (row: OwnerOnboardingLinkRow): OwnerOnboardingLink => ({
  id: row.id, implementationId: row.implementation_id, ownerId: row.owner_id, tokenHash: row.token_hash,
  createdAt: row.created_at, createdBy: row.created_by, expiresAt: row.expires_at, usedAt: row.used_at,
  revokedAt: row.revoked_at, lastAccessAt: row.last_access_at, publicSnapshot: row.public_snapshot,
});

export interface OwnerOnboardingSubmissionRow {
  implementation_id: string; full_name: string; document: string | null; email: string;
  phone: string; pix_key: string | null; submitted_at: string;
}
export const ownerOnboardingSubmissionFromRow = (row: OwnerOnboardingSubmissionRow): OwnerOnboardingSubmission => ({
  implementationId: row.implementation_id, fullName: row.full_name, document: row.document,
  email: row.email, phone: row.phone, pixKey: row.pix_key, submittedAt: row.submitted_at,
});
