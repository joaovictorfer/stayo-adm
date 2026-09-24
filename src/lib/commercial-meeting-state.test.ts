import { describe, expect, it } from "vitest";

import {
  canTransitionCommercialMeeting,
  commercialUrgency,
  toLocalDateTimeInput,
} from "./commercial-meeting-state";
import type { CommercialOverviewRow } from "../types/commercial-journey";

const overview = (patch: Partial<CommercialOverviewRow> = {}): CommercialOverviewRow => ({
  implementationId: "implementation-1",
  meetingStartsAt: null,
  meetingTimeZone: null,
  meetingMode: null,
  meetingStatus: null,
  meetingResponsibleUserId: null,
  meetingResponsibleName: null,
  nextActionTitle: null,
  nextActionDueAt: null,
  nextActionTimeZone: null,
  nextActionResponsibleUserId: null,
  nextActionResponsibleName: null,
  ...patch,
});

describe("commercial meeting transitions", () => {
  it("permite encerrar ou reagendar somente reunião ativa", () => {
    expect(canTransitionCommercialMeeting("scheduled", "completed")).toBe(true);
    expect(canTransitionCommercialMeeting("scheduled", "rescheduled")).toBe(true);
    expect(canTransitionCommercialMeeting("confirmed", "no_show")).toBe(true);
    expect(canTransitionCommercialMeeting("completed", "scheduled")).toBe(false);
    expect(canTransitionCommercialMeeting("cancelled", "completed")).toBe(false);
    expect(canTransitionCommercialMeeting("no_show", "rescheduled")).toBe(false);
  });
});

describe("commercial urgency", () => {
  const now = new Date("2026-09-24T15:00:00Z");

  it("marca ação vencida como prioridade máxima", () => {
    expect(
      commercialUrgency(
        overview({
          nextActionTitle: "Retornar proprietário",
          nextActionDueAt: "2026-09-24T14:59:00Z",
          meetingStartsAt: "2026-09-24T16:00:00Z",
        }),
        now,
      ),
    ).toBe("overdue_action");
  });

  it("marca reunião nas próximas 24 horas", () => {
    expect(
      commercialUrgency(
        overview({
          meetingStartsAt: "2026-09-25T14:59:00Z",
          meetingStatus: "scheduled",
        }),
        now,
      ),
    ).toBe("meeting_soon");
  });

  it("não sinaliza reunião distante nem ação futura", () => {
    expect(
      commercialUrgency(
        overview({
          meetingStartsAt: "2026-09-26T15:00:00Z",
          nextActionDueAt: "2026-09-25T18:00:00Z",
        }),
        now,
      ),
    ).toBeNull();
  });
});

describe("toLocalDateTimeInput", () => {
  it("preserva o horário operacional no fuso salvo", () => {
    expect(toLocalDateTimeInput("2026-10-02T18:00:00Z", "America/Sao_Paulo")).toBe(
      "2026-10-02T15:00",
    );
  });
});
