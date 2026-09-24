import type { EntityId } from "./core";

export type CommercialMeetingMode = "video" | "phone" | "in_person";

/**
 * `rescheduled` representa uma ocorrência histórica substituída por outra.
 * A reunião atualmente válida deve ser uma nova ocorrência `scheduled` ou
 * `confirmed`, preservando assim autoria e histórico sem sobrescrever fatos.
 */
export type CommercialMeetingStatus =
  | "scheduled"
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "completed";

/** Contrato interno do Admin. Não deve ser devolvido diretamente ao convite público. */
export interface CommercialMeetingRecord {
  id: EntityId;
  implementationId: EntityId;
  startsAt: string;
  endsAt: string | null;
  timeZone: string;
  mode: CommercialMeetingMode;
  joinUrl: string | null;
  status: CommercialMeetingStatus;
  responsibleUserId: EntityId | null;
  internalNote: string | null;
  createdBy: EntityId | null;
  createdAt: string;
  updatedAt: string;
}

/** Projeção mínima que uma RPC de convite poderá devolver no futuro. */
export interface CommercialMeetingPublicProjection {
  startsAt: string;
  endsAt: string | null;
  timeZone: string;
  mode: CommercialMeetingMode;
  joinUrl: string | null;
  status: CommercialMeetingStatus;
}

export type ProposalPresentationStatus =
  | "draft"
  | "published"
  | "acceptance_ready"
  | "accepted"
  | "superseded";

/**
 * Estado da versão comercial apresentada. O snapshot em si continuará no
 * banco; este tipo expressa apenas o estado necessário para decidir a UX.
 */
export interface ProposalPresentationState {
  proposalId: EntityId;
  version: number;
  status: ProposalPresentationStatus;
  publishedAt: string | null;
  acceptanceEnabled: boolean;
  acceptedAt: string | null;
  supersededAt: string | null;
}

export type CommercialJourneyNextAction =
  | "wait_for_publication"
  | "wait_for_meeting"
  | "join_meeting"
  | "review_proposal"
  | "accept_proposal"
  | "continue_journey";
