import { describe, expect, it } from "vitest";

import {
  canJoinCommercialMeeting,
  deriveCommercialJourneyNextAction,
  isSafeMeetingJoinUrl,
  toCommercialMeetingPublicProjection,
} from "./commercial-journey-state";
import type {
  CommercialMeetingRecord,
  ProposalPresentationState,
} from "../types/commercial-journey";

const meeting = (patch: Partial<CommercialMeetingRecord> = {}): CommercialMeetingRecord => ({
  id: "meeting-1",
  implementationId: "implementation-1",
  startsAt: "2026-10-02T15:00:00-03:00",
  endsAt: "2026-10-02T15:45:00-03:00",
  timeZone: "America/Sao_Paulo",
  mode: "video",
  joinUrl: "https://meet.example.com/stayo-123",
  status: "confirmed",
  responsibleUserId: "user-1",
  internalNote: "nota que nunca deve sair na projeção pública",
  createdBy: "user-1",
  createdAt: "2026-09-24T00:00:00Z",
  updatedAt: "2026-09-24T00:00:00Z",
  ...patch,
});

const proposal = (patch: Partial<ProposalPresentationState> = {}): ProposalPresentationState => ({
  proposalId: "proposal-1",
  version: 1,
  status: "published",
  publishedAt: "2026-09-24T00:00:00Z",
  acceptanceEnabled: false,
  acceptedAt: null,
  supersededAt: null,
  ...patch,
});

describe("isSafeMeetingJoinUrl", () => {
  it("aceita apenas URL HTTPS válida", () => {
    expect(isSafeMeetingJoinUrl("https://meet.example.com/room")).toBe(true);
    expect(isSafeMeetingJoinUrl("http://meet.example.com/room")).toBe(false);
    expect(isSafeMeetingJoinUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMeetingJoinUrl("meet.example.com/room")).toBe(false);
    expect(isSafeMeetingJoinUrl(null)).toBe(false);
  });
});

describe("toCommercialMeetingPublicProjection", () => {
  it("remove dados internos e só libera o link quando confirmada", () => {
    const scheduled = toCommercialMeetingPublicProjection(meeting({ status: "scheduled" }));
    expect(scheduled.joinUrl).toBeNull();
    expect("internalNote" in scheduled).toBe(false);
    expect("responsibleUserId" in scheduled).toBe(false);

    const confirmed = toCommercialMeetingPublicProjection(meeting());
    expect(confirmed.joinUrl).toBe("https://meet.example.com/stayo-123");
    expect(canJoinCommercialMeeting(confirmed)).toBe(true);
  });

  it("não expõe link em reunião reagendada, cancelada ou com URL insegura", () => {
    expect(
      toCommercialMeetingPublicProjection(meeting({ status: "rescheduled" })).joinUrl,
    ).toBeNull();
    expect(toCommercialMeetingPublicProjection(meeting({ status: "cancelled" })).joinUrl).toBeNull();
    expect(
      toCommercialMeetingPublicProjection(meeting({ joinUrl: "http://meet.example.com/room" })).joinUrl,
    ).toBeNull();
  });
});

describe("deriveCommercialJourneyNextAction", () => {
  it("mantém a jornada aguardando enquanto não existe versão publicada", () => {
    expect(deriveCommercialJourneyNextAction({ proposal: null, meeting: null })).toBe(
      "wait_for_publication",
    );
    expect(
      deriveCommercialJourneyNextAction({
        proposal: proposal({ status: "draft", publishedAt: null }),
        meeting: null,
      }),
    ).toBe("wait_for_publication");
  });

  it("diferencia reunião planejada de reunião confirmada com participação", () => {
    const scheduled = toCommercialMeetingPublicProjection(meeting({ status: "scheduled" }));
    expect(deriveCommercialJourneyNextAction({ proposal: proposal(), meeting: scheduled })).toBe(
      "wait_for_meeting",
    );

    const confirmed = toCommercialMeetingPublicProjection(meeting());
    expect(deriveCommercialJourneyNextAction({ proposal: proposal(), meeting: confirmed })).toBe(
      "join_meeting",
    );
  });

  it("não oferece participação em reunião cancelada e segue para análise da proposta", () => {
    const cancelled = toCommercialMeetingPublicProjection(meeting({ status: "cancelled" }));
    expect(deriveCommercialJourneyNextAction({ proposal: proposal(), meeting: cancelled })).toBe(
      "review_proposal",
    );
  });

  it("oferece aceite somente para versão explicitamente apta", () => {
    expect(
      deriveCommercialJourneyNextAction({
        proposal: proposal({ status: "acceptance_ready", acceptanceEnabled: true }),
        meeting: null,
      }),
    ).toBe("accept_proposal");

    expect(
      deriveCommercialJourneyNextAction({
        proposal: proposal({ status: "acceptance_ready", acceptanceEnabled: false }),
        meeting: null,
      }),
    ).toBe("review_proposal");
  });

  it("após aceite orienta a continuar a jornada", () => {
    expect(
      deriveCommercialJourneyNextAction({
        proposal: proposal({
          status: "accepted",
          acceptanceEnabled: true,
          acceptedAt: "2026-09-25T12:00:00Z",
        }),
        meeting: null,
      }),
    ).toBe("continue_journey");
  });
});
