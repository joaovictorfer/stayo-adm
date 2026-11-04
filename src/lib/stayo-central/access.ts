import { isValidCpf } from "../owner-form-validation";
import type { CentralCheckin, CentralReservation } from "./provider-contracts";

export interface LocalProjectLink { id: string; owner_id: string | null; core_property_id: string | null; core_owner_id: string | null; status: string }
export interface LocalOwnerLink { id: string; core_owner_id: string | null }
export interface LocalAccessSnapshot {
  userId: string;
  adminAllowed: boolean;
  sensitiveAllowed: boolean;
  projects: LocalProjectLink[];
  owners: LocalOwnerLink[];
}
export type AccessDecision = { ok: true; project: LocalProjectLink } | { ok: false; kind: "forbidden" | "ambiguous_link" | "unlinked" };

/** Snapshot must be loaded afresh through the authenticated user's RLS client. */
export function authorizeCentralReservation(snapshot: LocalAccessSnapshot, reservation: CentralReservation, sensitive = false): AccessDecision {
  if (!snapshot.userId || !snapshot.adminAllowed || (sensitive && !snapshot.sensitiveAllowed)) return { ok: false, kind: "forbidden" };
  if (!reservation.id || !reservation.property_id) return { ok: false, kind: "unlinked" };
  const projects = snapshot.projects.filter(p => p.core_property_id === reservation.property_id);
  if (projects.length !== 1) return { ok: false, kind: projects.length ? "ambiguous_link" : "unlinked" };
  const project = projects[0];
  if (!project || !project.owner_id || !project.core_owner_id || project.status !== "ativo") return { ok: false, kind: "unlinked" };
  const owners = snapshot.owners.filter(o => o.id === project.owner_id && o.core_owner_id === project.core_owner_id);
  if (owners.length !== 1 || snapshot.owners.filter(o => o.core_owner_id === project.core_owner_id).length !== 1) return { ok: false, kind: "ambiguous_link" };
  return { ok: true, project };
}

/** Guest CPF is NOT owner CPF. Portal roles grant no guest-document purpose. */
export function restrictedTitular(checkin: CentralCheckin, permitted: boolean, scopes: string[]) {
  const deny = { status: "restricted", document: null } as const;
  if (!permitted || !scopes.includes("admin:read") || !scopes.includes("admin:sensitive")) return deny;
  const t = checkin.titular;
  if (t.titular_status !== "resolved") return { status: t.titular_status, document: null };
  const primary = checkin.guests.filter(g => g.is_primary);
  if (primary.length !== 1 || primary[0]?.id !== t.guest_id) return { status: "ambiguous", document: null };
  if (t.document_visibility !== "sensitive_scope") return deny;
  if (t.document_status !== "valid_cpf") return { status: t.document_status ?? "missing", document: null };
  if (!t.document || !isValidCpf(t.document)) return { status: "invalid_cpf", document: null };
  return { status: "valid_cpf", document: t.document };
}