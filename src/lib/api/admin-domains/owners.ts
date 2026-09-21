import type { OwnerRecord, OwnerRecordInput } from "../../../types/admin";
import type { OwnerAdministrativeRegistration } from "../../../types/owner-onboarding";

export interface AdminOwnersDomain {
  owners: {
    list(params?: { q?: string }): Promise<OwnerRecord[]>;
    get(id: string): Promise<OwnerRecord | null>;
    create(input: OwnerRecordInput): Promise<OwnerRecord>;
    update(id: string, patch: Partial<Omit<OwnerRecord, "id" | "createdAt">>): Promise<OwnerRecord>;
    findOrCreateByPhone(input: OwnerRecordInput): Promise<OwnerRecord>;
    getAdministrativeRegistration(implementationIds: string[]): Promise<OwnerAdministrativeRegistration | null>;
  };
}

export interface OwnerRecordRow {
  id: string; name: string; phone: string | null; email: string | null; document: string | null;
  lifecycle_status: OwnerRecord["lifecycleStatus"]; core_owner_id: string | null;
  created_at: string; updated_at: string;
}

export interface OwnerAdministrativeRegistrationRow {
  implementation_id: string; submitted_at: string | null; bank_name: string | null;
  account_holder: string | null; holder_tax_id: string | null;
  pix_type: OwnerAdministrativeRegistration["pixType"]; pix_key: string | null; is_primary: boolean | null;
}

export function ownerFromRow(row: OwnerRecordRow): OwnerRecord {
  return { id: row.id, name: row.name, phone: row.phone, email: row.email, document: row.document,
    lifecycleStatus: row.lifecycle_status, coreOwnerId: row.core_owner_id,
    createdAt: row.created_at, updatedAt: row.updated_at };
}
