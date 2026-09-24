import type { EntityId } from "./core";

export type CommercialMeetingMode = "video" | "in_person";

/**
 * `rescheduled` representa uma ocorrência histórica substituída por outra.
 * A reunião atualmente válida nasce como uma nova ocorrência `scheduled`,
 * preservando data, responsável e estado da ocorrência anterior.
 */
export type CommercialMeetingStatus =
  "scheduled" | "confirmed" | "rescheduled" | "cancelled" | "completed" | "no_show";

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
  responsibleUserId: EntityId;
  responsibleName: string;
  rescheduledFromId: EntityId | null;
  version: number;
  createdBy: EntityId;
  updatedBy: EntityId;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialMeetingEvent {
  id: EntityId;
  meetingId: EntityId;
  implementationId: EntityId;
  eventType: CommercialMeetingStatus;
  fromStatus: CommercialMeetingStatus | null;
  toStatus: CommercialMeetingStatus;
  startsAt: string;
  endsAt: string | null;
  timeZone: string;
  mode: CommercialMeetingMode;
  responsibleUserId: EntityId;
  responsibleName: string;
  replacementMeetingId: EntityId | null;
  actorId: EntityId;
  createdAt: string;
}

export type CommercialNextActionStatus = "active" | "completed" | "cancelled" | "superseded";

export interface CommercialNextActionRecord {
  id: EntityId;
  implementationId: EntityId;
  title: string;
  dueAt: string;
  timeZone: string;
  responsibleUserId: EntityId | null;
  responsibleName: string | null;
  status: CommercialNextActionStatus;
  version: number;
  createdBy?: EntityId;
  updatedBy?: EntityId;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface CommercialMeetingState {
  currentMeeting: CommercialMeetingRecord | null;
  meetings: CommercialMeetingRecord[];
  events: CommercialMeetingEvent[];
  nextAction: CommercialNextActionRecord | null;
  actionHistory: CommercialNextActionRecord[];
}

export interface CommercialAssignee {
  id: EntityId;
  fullName: string;
  role: "super_admin" | "admin" | "commercial" | "operations";
}

export interface CommercialOverviewRow {
  implementationId: EntityId;
  meetingStartsAt: string | null;
  meetingTimeZone: string | null;
  meetingMode: CommercialMeetingMode | null;
  meetingStatus: Extract<CommercialMeetingStatus, "scheduled" | "confirmed"> | null;
  meetingResponsibleUserId: EntityId | null;
  meetingResponsibleName: string | null;
  nextActionTitle: string | null;
  nextActionDueAt: string | null;
  nextActionTimeZone: string | null;
  nextActionResponsibleUserId: EntityId | null;
  nextActionResponsibleName: string | null;
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
  "draft" | "published" | "acceptance_ready" | "accepted" | "superseded";

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
