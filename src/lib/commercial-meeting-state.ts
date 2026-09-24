import type {
  CommercialMeetingStatus,
  CommercialOverviewRow,
} from "../types/commercial-journey";

export const commercialMeetingStatusLabels: Record<CommercialMeetingStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  rescheduled: "Reagendada",
  cancelled: "Cancelada",
  completed: "Realizada",
  no_show: "Não compareceu",
};

export const commercialMeetingModeLabels = {
  video: "Videochamada",
  in_person: "Presencial",
} as const;

export function canTransitionCommercialMeeting(
  from: CommercialMeetingStatus,
  to: CommercialMeetingStatus,
): boolean {
  if (from === "scheduled") {
    return ["confirmed", "completed", "cancelled", "no_show", "rescheduled"].includes(to);
  }
  if (from === "confirmed") {
    return ["completed", "cancelled", "no_show", "rescheduled"].includes(to);
  }
  return false;
}

export type CommercialUrgency = "overdue_action" | "meeting_soon" | null;

/**
 * Prioridade interna: ação vencida é mais urgente que reunião próxima.
 * Não dispara comunicação externa; serve somente para sinalização visual.
 */
export function commercialUrgency(
  overview: CommercialOverviewRow | null | undefined,
  now = new Date(),
): CommercialUrgency {
  if (!overview) return null;

  if (overview.nextActionDueAt) {
    const dueAt = new Date(overview.nextActionDueAt);
    if (!Number.isNaN(dueAt.getTime()) && dueAt.getTime() < now.getTime()) {
      return "overdue_action";
    }
  }

  if (overview.meetingStartsAt) {
    const startsAt = new Date(overview.meetingStartsAt);
    const delta = startsAt.getTime() - now.getTime();
    if (!Number.isNaN(delta) && delta >= 0 && delta <= 24 * 60 * 60 * 1000) {
      return "meeting_soon";
    }
  }

  return null;
}

export function resolvedTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

export function formatCommercialDateTime(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }
}

/** Converte um ISO absoluto para `datetime-local` respeitando o fuso salvo. */
export function toLocalDateTimeInput(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}
