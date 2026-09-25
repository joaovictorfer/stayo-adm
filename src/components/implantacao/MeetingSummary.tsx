import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Video, MapPin } from "lucide-react";

import { commercialMeetingsApi } from "../../lib/api/commercial-meetings";
import {
  commercialMeetingModeLabels,
  commercialMeetingStatusLabels,
  formatCommercialDateTime,
} from "../../lib/commercial-meeting-state";
import type { CommercialMeetingStatus } from "../../types/commercial-journey";

const tone: Record<CommercialMeetingStatus, string> = {
  scheduled: "var(--stayo-forest)",
  confirmed: "var(--stayo-forest)",
  rescheduled: "var(--stayo-ink-muted)",
  completed: "var(--stayo-success)",
  cancelled: "var(--stayo-danger)",
  no_show: "var(--stayo-warning)",
};

/**
 * Resumo da ficha: próxima reunião + linha do tempo de reuniões.
 * Reutiliza o mesmo estado persistido do painel comercial (mesma query key).
 */
export function MeetingSummary({ implementationId }: { implementationId: string }) {
  const q = useQuery({
    queryKey: ["commercial", "meeting-state", implementationId],
    queryFn: () => commercialMeetingsApi.getState(implementationId),
    staleTime: 15_000,
    retry: 1,
  });
  if (q.isPending) {
    return <p className="text-xs text-[var(--stayo-ink-muted)]">Carregando reuniões…</p>;
  }
  if (q.isError) {
    return (
      <p className="text-xs text-[var(--stayo-ink-muted)]">
        Reuniões indisponíveis para o seu perfil.
      </p>
    );
  }
  const { currentMeeting, events } = q.data;
  return (
    <div className="flex flex-col gap-4">
      {currentMeeting ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-3">
          <div className="flex items-center gap-2 text-xs text-[var(--stayo-ink-muted)]">
            {currentMeeting.mode === "video" ? (
              <Video className="size-3.5" />
            ) : (
              <MapPin className="size-3.5" />
            )}
            {commercialMeetingModeLabels[currentMeeting.mode]} ·{" "}
            {commercialMeetingStatusLabels[currentMeeting.status]}
          </div>
          <p className="mt-1 text-sm font-semibold text-[var(--stayo-ink)]">
            {formatCommercialDateTime(currentMeeting.startsAt, currentMeeting.timeZone)}
          </p>
          <p className="text-[11px] text-[var(--stayo-ink-muted)]">
            {currentMeeting.timeZone} · {currentMeeting.responsibleName}
          </p>
          {currentMeeting.mode === "video" && currentMeeting.joinUrl && (
            <a
              href={currentMeeting.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs font-medium text-[var(--stayo-forest)] underline"
            >
              Abrir Google Meet
            </a>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-[var(--stayo-ink-muted)]">
          <CalendarClock className="size-4" /> Nenhuma reunião agendada.
        </p>
      )}
      {events.length > 0 && (
        <ol className="flex flex-col gap-3">
          {events.slice(0, 6).map((e) => (
            <li key={e.id} className="flex gap-3">
              <span
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: tone[e.toStatus] }}
              />
              <div className="min-w-0">
                <p className="text-sm text-[var(--stayo-ink)]">
                  Reunião {commercialMeetingStatusLabels[e.toStatus].toLowerCase()} ·{" "}
                  {formatCommercialDateTime(e.startsAt, e.timeZone)}
                </p>
                <p className="text-[11px] text-[var(--stayo-ink-muted)]">
                  Registrado em {formatCommercialDateTime(e.createdAt, e.timeZone)} ·{" "}
                  {e.responsibleName}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
