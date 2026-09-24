import type {
  CommercialJourneyNextAction,
  CommercialMeetingPublicProjection,
  CommercialMeetingRecord,
  ProposalPresentationState,
} from "../types/commercial-journey";

/**
 * Links de participação enviados ao proprietário precisam ser HTTPS.
 * Não tentamos reconhecer marcas/provedores específicos: a autorização
 * continua no servidor e esta função apenas evita esquemas inseguros na UX.
 */
export function isSafeMeetingJoinUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Minimiza o registro interno antes de qualquer futura exposição pública.
 * Notas internas, responsável e autoria nunca entram nesta projeção.
 * O link só aparece quando a reunião está explicitamente confirmada.
 */
export function toCommercialMeetingPublicProjection(
  meeting: CommercialMeetingRecord,
): CommercialMeetingPublicProjection {
  const mayExposeJoinUrl = meeting.status === "confirmed" && isSafeMeetingJoinUrl(meeting.joinUrl);
  return {
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
    timeZone: meeting.timeZone,
    mode: meeting.mode,
    joinUrl: mayExposeJoinUrl ? meeting.joinUrl : null,
    status: meeting.status,
  };
}

export function canJoinCommercialMeeting(
  meeting: CommercialMeetingPublicProjection | null | undefined,
): boolean {
  return Boolean(
    meeting &&
      meeting.status === "confirmed" &&
      meeting.mode === "video" &&
      isSafeMeetingJoinUrl(meeting.joinUrl),
  );
}

export function deriveCommercialJourneyNextAction(input: {
  proposal: ProposalPresentationState | null | undefined;
  meeting: CommercialMeetingPublicProjection | null | undefined;
}): CommercialJourneyNextAction {
  const { proposal, meeting } = input;

  if (!proposal || proposal.status === "draft" || !proposal.publishedAt) {
    return "wait_for_publication";
  }

  if (proposal.status === "accepted" || proposal.acceptedAt) {
    return "continue_journey";
  }

  if (meeting?.status === "scheduled" || meeting?.status === "confirmed") {
    return canJoinCommercialMeeting(meeting) ? "join_meeting" : "wait_for_meeting";
  }

  if (proposal.status === "acceptance_ready" && proposal.acceptanceEnabled) {
    return "accept_proposal";
  }

  return "review_proposal";
}
