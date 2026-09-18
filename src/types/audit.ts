import type { EntityId } from "./core";

/**
 * Eventos de auditoria (seção 30 do plano de evolução). Lista fechada de
 * propósito — cada evento novo deve ser adicionado aqui explicitamente,
 * nunca como string livre, para manter a auditoria consultável.
 */
export type AuditEvent =
  | "auth.login"
  | "owner.created"
  | "owner.updated"
  | "implementation.created"
  | "implementation.status_changed"
  | "timeline.item_updated"
  | "readiness.override"
  | "proposal.version_created"
  | "proposal.sent"
  | "proposal.accepted"
  | "portal.invitation_created"
  | "portal.invitation_revoked"
  | "owner.data_submitted"
  | "charge.created"
  | "charge.status_changed"
  | "core_conversion.requested"
  | "core_conversion.completed";

export interface AuditLogEntry {
  id: EntityId;
  actorId: EntityId | null;
  event: AuditEvent;
  entityType: string;
  entityId: EntityId | null;
  /** Nunca deve conter senha, token, documento completo ou segredo. */
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type AuditLogInput = Omit<AuditLogEntry, "id" | "createdAt">;
