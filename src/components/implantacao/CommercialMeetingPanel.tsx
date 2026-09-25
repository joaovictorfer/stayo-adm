import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  MapPin,
  RotateCw,
  UserRound,
  Video,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { isSafeMeetingJoinUrl } from "../../lib/commercial-journey-state";
import {
  commercialMeetingsApi,
  type RescheduleCommercialMeetingInput,
  type ScheduleCommercialMeetingInput,
  type SetCommercialNextActionInput,
} from "../../lib/api/commercial-meetings";
import {
  commercialMeetingModeLabels,
  commercialMeetingStatusLabels,
  formatCommercialDateTime,
  resolvedTimeZone,
  toLocalDateTimeInput,
} from "../../lib/commercial-meeting-state";
import type {
  CommercialAssignee,
  CommercialMeetingMode,
  CommercialMeetingState,
  CommercialMeetingStatus,
} from "../../types/commercial-journey";

const timeZones = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Rio_Branco",
  "America/Noronha",
  "UTC",
];

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Erro desconhecido");
  }
  return "Não foi possível carregar a agenda comercial.";
}

function isPermissionError(error: unknown): boolean {
  const message = errorMessage(error).toLocaleLowerCase("pt-BR");
  return message.includes("sem permissão") || message.includes("permission denied");
}

export function CommercialMeetingPanel({
  implementationId,
  initialResponsibleUserId,
}: {
  implementationId: string;
  initialResponsibleUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const stateQuery = useQuery({
    queryKey: ["commercial", "meeting-state", implementationId],
    queryFn: () => commercialMeetingsApi.getState(implementationId),
    retry: 1,
  });
  const assigneesQuery = useQuery({
    queryKey: ["commercial", "assignees"],
    queryFn: () => commercialMeetingsApi.listAssignees(),
    retry: 1,
  });

  const updateState = async (state: CommercialMeetingState, message: string) => {
    queryClient.setQueryData(["commercial", "meeting-state", implementationId], state);
    await queryClient.invalidateQueries({ queryKey: ["commercial", "overview"] });
    toast.success(message);
  };

  const scheduleMutation = useMutation({
    mutationFn: (input: ScheduleCommercialMeetingInput) => commercialMeetingsApi.schedule(input),
    onSuccess: (state) => updateState(state, "Reunião agendada"),
    onError: (error) =>
      toast.error("Não foi possível agendar", { description: errorMessage(error) }),
  });
  const rescheduleMutation = useMutation({
    mutationFn: (input: RescheduleCommercialMeetingInput) =>
      commercialMeetingsApi.reschedule(input),
    onSuccess: (state) => updateState(state, "Reunião reagendada"),
    onError: (error) =>
      toast.error("Não foi possível reagendar", { description: errorMessage(error) }),
  });
  const statusMutation = useMutation({
    mutationFn: (input: {
      meetingId: string;
      expectedVersion: number;
      status: Extract<CommercialMeetingStatus, "completed" | "cancelled" | "no_show">;
    }) => commercialMeetingsApi.updateStatus(input),
    onSuccess: (state) => updateState(state, "Status da reunião atualizado"),
    onError: (error) =>
      toast.error("Não foi possível atualizar a reunião", { description: errorMessage(error) }),
  });
  const actionMutation = useMutation({
    mutationFn: (input: SetCommercialNextActionInput) => commercialMeetingsApi.setNextAction(input),
    onSuccess: (state) => updateState(state, "Próxima ação salva"),
    onError: (error) =>
      toast.error("Não foi possível salvar a próxima ação", { description: errorMessage(error) }),
  });
  const closeActionMutation = useMutation({
    mutationFn: (input: {
      actionId: string;
      expectedVersion: number;
      status: "completed" | "cancelled";
    }) => commercialMeetingsApi.closeNextAction(input),
    onSuccess: (state) => updateState(state, "Próxima ação atualizada"),
    onError: (error) =>
      toast.error("Não foi possível atualizar a próxima ação", {
        description: errorMessage(error),
      }),
  });

  const busy =
    scheduleMutation.isPending ||
    rescheduleMutation.isPending ||
    statusMutation.isPending ||
    actionMutation.isPending ||
    closeActionMutation.isPending;

  if (stateQuery.isPending || assigneesQuery.isPending) {
    return (
      <section className="rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-5">
        <div className="flex items-center gap-2 text-sm text-[var(--stayo-ink-muted)]">
          <Loader2 className="size-4 animate-spin" /> Carregando agenda comercial…
        </div>
      </section>
    );
  }

  if (stateQuery.isError || assigneesQuery.isError) {
    const error = stateQuery.error ?? assigneesQuery.error;
    const denied = isPermissionError(error);
    return (
      <section
        role="alert"
        className="rounded-[var(--radius-card)] border p-5"
        style={{
          borderColor: denied ? "var(--stayo-danger)" : "var(--stayo-warning)",
          backgroundColor: "var(--stayo-surface)",
        }}
      >
        <h3 className="text-sm font-semibold text-[var(--stayo-ink)]">
          {denied ? "Acesso não autorizado" : "Agenda comercial indisponível"}
        </h3>
        <p className="mt-1 text-sm text-[var(--stayo-ink-muted)]">
          {denied
            ? "Seu perfil não possui permissão para consultar ou alterar reuniões comerciais."
            : "Os dados não foram tratados como vazios. Tente carregar novamente."}
        </p>
        {!denied && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void stateQuery.refetch();
              void assigneesQuery.refetch();
            }}
          >
            <RotateCw className="size-4" /> Tentar novamente
          </Button>
        )}
      </section>
    );
  }

  return (
    <CommercialMeetingContent
      implementationId={implementationId}
      initialResponsibleUserId={initialResponsibleUserId}
      state={stateQuery.data}
      assignees={assigneesQuery.data}
      busy={busy}
      onSchedule={(input) => scheduleMutation.mutate(input)}
      onReschedule={(input) => rescheduleMutation.mutate(input)}
      onStatus={(input) => statusMutation.mutate(input)}
      onAction={(input) => actionMutation.mutate(input)}
      onCloseAction={(input) => closeActionMutation.mutate(input)}
    />
  );
}

function CommercialMeetingContent({
  implementationId,
  initialResponsibleUserId,
  state,
  assignees,
  busy,
  onSchedule,
  onReschedule,
  onStatus,
  onAction,
  onCloseAction,
}: {
  implementationId: string;
  initialResponsibleUserId: string | null;
  state: CommercialMeetingState;
  assignees: CommercialAssignee[];
  busy: boolean;
  onSchedule: (input: ScheduleCommercialMeetingInput) => void;
  onReschedule: (input: RescheduleCommercialMeetingInput) => void;
  onStatus: (input: {
    meetingId: string;
    expectedVersion: number;
    status: "completed" | "cancelled" | "no_show";
  }) => void;
  onAction: (input: SetCommercialNextActionInput) => void;
  onCloseAction: (input: {
    actionId: string;
    expectedVersion: number;
    status: "completed" | "cancelled";
  }) => void;
}) {
  const current = state.currentMeeting;
  const defaultAssignee = useMemo(
    () =>
      assignees.find((item) => item.id === initialResponsibleUserId)?.id ?? assignees[0]?.id ?? "",
    [assignees, initialResponsibleUserId],
  );
  const [meetingFormOpen, setMeetingFormOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [meetingTimeZone, setMeetingTimeZone] = useState("America/Sao_Paulo");
  const [mode, setMode] = useState<CommercialMeetingMode>("video");
  const [joinUrl, setJoinUrl] = useState("");
  const [meetingResponsible, setMeetingResponsible] = useState(defaultAssignee);
  const [actionFormOpen, setActionFormOpen] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [actionDueLocal, setActionDueLocal] = useState("");
  const [actionTimeZone, setActionTimeZone] = useState("America/Sao_Paulo");
  const [actionResponsible, setActionResponsible] = useState(defaultAssignee);

  useEffect(() => {
    if (!meetingResponsible && defaultAssignee) setMeetingResponsible(defaultAssignee);
    if (!actionResponsible && defaultAssignee) setActionResponsible(defaultAssignee);
  }, [actionResponsible, defaultAssignee, meetingResponsible]);

  const openSchedule = () => {
    setRescheduling(false);
    setStartsAtLocal("");
    setMeetingTimeZone("America/Sao_Paulo");
    setMode("video");
    setJoinUrl("");
    setMeetingResponsible(defaultAssignee);
    setMeetingFormOpen(true);
  };

  const openReschedule = () => {
    if (!current) return;
    setRescheduling(true);
    setStartsAtLocal(toLocalDateTimeInput(current.startsAt, current.timeZone));
    setMeetingTimeZone(current.timeZone);
    setMode(current.mode);
    setJoinUrl(current.joinUrl ?? "");
    setMeetingResponsible(current.responsibleUserId);
    setMeetingFormOpen(true);
  };

  const validJoinUrl = mode !== "video" || !joinUrl.trim() || isSafeMeetingJoinUrl(joinUrl.trim());
  const validMeeting =
    !!startsAtLocal && !!meetingTimeZone && !!meetingResponsible && validJoinUrl && !busy;
  const validAction =
    actionTitle.trim().length >= 3 && !!actionDueLocal && !!actionTimeZone && !busy;

  const submitMeeting = () => {
    if (!validMeeting) return;
    if (rescheduling && current) {
      onReschedule({
        meetingId: current.id,
        expectedVersion: current.version,
        startsAtLocal,
        timeZone: meetingTimeZone,
        mode,
        joinUrl: mode === "video" ? joinUrl : null,
        responsibleUserId: meetingResponsible,
      });
    } else {
      onSchedule({
        implementationId,
        startsAtLocal,
        timeZone: meetingTimeZone,
        mode,
        joinUrl: mode === "video" ? joinUrl : null,
        responsibleUserId: meetingResponsible,
      });
    }
    setMeetingFormOpen(false);
  };

  return (
    <section className="space-y-4" aria-labelledby="commercial-meeting-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="implementation-section-label">Comercial</p>
          <h2
            id="commercial-meeting-heading"
            className="text-lg font-semibold text-[var(--stayo-ink)]"
          >
            Reunião e próxima ação
          </h2>
          <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
            Agenda interna persistente. Nenhuma comunicação é enviada automaticamente.
          </p>
        </div>
        {!current && (
          <Button
            type="button"
            size="sm"
            onClick={openSchedule}
            disabled={busy || !assignees.length}
          >
            <CalendarClock className="size-4" /> Agendar reunião
          </Button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-4">
          {current ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {current.mode === "video" ? (
                      <Video className="size-4 text-[var(--stayo-forest)]" />
                    ) : (
                      <MapPin className="size-4 text-[var(--stayo-forest)]" />
                    )}
                    <strong className="text-sm text-[var(--stayo-ink)]">
                      {commercialMeetingModeLabels[current.mode]}
                    </strong>
                  </div>
                  <p className="mt-2 text-base font-semibold text-[var(--stayo-ink)]">
                    {formatCommercialDateTime(current.startsAt, current.timeZone)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
                    {current.timeZone} · {commercialMeetingStatusLabels[current.status]}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--stayo-forest-soft)] px-2.5 py-1 text-xs font-medium text-[var(--stayo-forest)]">
                  {commercialMeetingStatusLabels[current.status]}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-[var(--stayo-ink-muted)]">
                <UserRound className="size-4" /> {current.responsibleName}
              </div>
              {current.mode === "video" && current.joinUrl && (
                <a
                  href={current.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-medium text-[var(--stayo-forest)] underline"
                >
                  Abrir Google Meet
                </a>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openReschedule}
                  disabled={busy}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    onStatus({
                      meetingId: current.id,
                      expectedVersion: current.version,
                      status: "completed",
                    })
                  }
                >
                  <CheckCircle2 className="size-4" /> Realizada
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    onStatus({
                      meetingId: current.id,
                      expectedVersion: current.version,
                      status: "no_show",
                    })
                  }
                >
                  Não compareceu
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    onStatus({
                      meetingId: current.id,
                      expectedVersion: current.version,
                      status: "cancelled",
                    })
                  }
                >
                  <XCircle className="size-4" /> Cancelar
                </Button>
              </div>
            </>
          ) : (
            <div className="py-2">
              <CalendarClock className="size-5 text-[var(--stayo-ink-muted)]" />
              <p className="mt-3 text-sm font-medium text-[var(--stayo-ink)]">
                Nenhuma reunião ativa
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--stayo-ink-muted)]">
                Agende quando fizer sentido. Condomínio, unidade e Property operacional não são
                necessários.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 text-[var(--stayo-forest)]" />
                <strong className="text-sm text-[var(--stayo-ink)]">Próxima ação</strong>
              </div>
              {state.nextAction ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-[var(--stayo-ink)]">
                    {state.nextAction.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
                    Até{" "}
                    {formatCommercialDateTime(state.nextAction.dueAt, state.nextAction.timeZone)}
                    {state.nextAction.responsibleName
                      ? ` · ${state.nextAction.responsibleName}`
                      : ""}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--stayo-ink-muted)]">Nenhuma ação definida.</p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setActionFormOpen(true)}
              disabled={busy}
            >
              {state.nextAction ? "Alterar" : "Definir"}
            </Button>
          </div>
          {state.nextAction && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  onCloseAction({
                    actionId: state.nextAction!.id,
                    expectedVersion: state.nextAction!.version,
                    status: "completed",
                  })
                }
              >
                <CheckCircle2 className="size-4" /> Concluir
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  onCloseAction({
                    actionId: state.nextAction!.id,
                    expectedVersion: state.nextAction!.version,
                    status: "cancelled",
                  })
                }
              >
                Cancelar ação
              </Button>
            </div>
          )}
        </div>
      </div>

      {meetingFormOpen && (
        <MeetingForm
          title={rescheduling ? "Editar reunião" : "Agendar reunião"}
          startsAtLocal={startsAtLocal}
          onStartsAtLocal={setStartsAtLocal}
          timeZone={meetingTimeZone}
          onTimeZone={setMeetingTimeZone}
          mode={mode}
          onMode={setMode}
          joinUrl={joinUrl}
          onJoinUrl={setJoinUrl}
          responsible={meetingResponsible}
          onResponsible={setMeetingResponsible}
          assignees={assignees}
          validJoinUrl={validJoinUrl}
          busy={busy}
          valid={validMeeting}
          onCancel={() => setMeetingFormOpen(false)}
          onSubmit={submitMeeting}
        />
      )}

      {actionFormOpen && (
        <ActionForm
          title={actionTitle}
          onTitle={setActionTitle}
          dueAtLocal={actionDueLocal}
          onDueAtLocal={setActionDueLocal}
          timeZone={actionTimeZone}
          onTimeZone={setActionTimeZone}
          responsible={actionResponsible}
          onResponsible={setActionResponsible}
          assignees={assignees}
          busy={busy}
          valid={validAction}
          onCancel={() => setActionFormOpen(false)}
          onSubmit={() => {
            if (!validAction) return;
            onAction({
              implementationId,
              title: actionTitle,
              dueAtLocal: actionDueLocal,
              timeZone: actionTimeZone,
              responsibleUserId: actionResponsible || null,
            });
            setActionFormOpen(false);
            setActionTitle("");
            setActionDueLocal("");
          }}
        />
      )}

      {(state.events.length > 0 || state.actionHistory.length > 0) && (
        <details
          open
          className="rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-4"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[var(--stayo-ink)]">
            <History className="size-4" /> Histórico comercial
          </summary>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--stayo-ink-muted)]">
                Reuniões
              </p>
              <ul className="mt-2 space-y-3">
                {state.events.map((event) => (
                  <li
                    key={event.id}
                    className="border-l-2 border-[var(--stayo-border)] pl-3 text-sm"
                  >
                    <p className="font-medium text-[var(--stayo-ink)]">
                      {commercialMeetingStatusLabels[event.toStatus]}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--stayo-ink-muted)]">
                      {formatCommercialDateTime(event.startsAt, event.timeZone)} ·{" "}
                      {event.responsibleName}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--stayo-ink-muted)]">
                Próximas ações
              </p>
              <ul className="mt-2 space-y-3">
                {state.actionHistory.map((action) => (
                  <li
                    key={action.id}
                    className="border-l-2 border-[var(--stayo-border)] pl-3 text-sm"
                  >
                    <p className="font-medium text-[var(--stayo-ink)]">{action.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--stayo-ink-muted)]">
                      {formatCommercialDateTime(action.dueAt, action.timeZone)} · {action.status}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}

function MeetingForm({
  title,
  startsAtLocal,
  onStartsAtLocal,
  timeZone,
  onTimeZone,
  mode,
  onMode,
  joinUrl,
  onJoinUrl,
  responsible,
  onResponsible,
  assignees,
  validJoinUrl,
  busy,
  valid,
  onCancel,
  onSubmit,
}: {
  title: string;
  startsAtLocal: string;
  onStartsAtLocal: (value: string) => void;
  timeZone: string;
  onTimeZone: (value: string) => void;
  mode: CommercialMeetingMode;
  onMode: (value: CommercialMeetingMode) => void;
  joinUrl: string;
  onJoinUrl: (value: string) => void;
  responsible: string;
  onResponsible: (value: string) => void;
  assignees: CommercialAssignee[];
  validJoinUrl: boolean;
  busy: boolean;
  valid: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-bg)] p-4">
      <h3 className="text-sm font-semibold text-[var(--stayo-ink)]">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Data e horário">
          <input
            type="datetime-local"
            value={startsAtLocal}
            onChange={(event) => onStartsAtLocal(event.target.value)}
            className="stayo-commercial-input"
          />
        </FormField>
        <TimeZoneField value={timeZone} onChange={onTimeZone} />
        <FormField label="Formato">
          <select
            value={mode}
            onChange={(event) => onMode(event.target.value as CommercialMeetingMode)}
            className="stayo-commercial-input"
          >
            <option value="video">Videochamada</option>
            <option value="in_person">Presencial</option>
          </select>
        </FormField>
        <AssigneeField
          value={responsible}
          onChange={onResponsible}
          assignees={assignees}
          required
        />
        {mode === "video" && (
          <FormField
            label="Link do Google Meet"
            hint="Opcional e informado manualmente. Nenhum convite é enviado."
          >
            <input
              type="url"
              inputMode="url"
              value={joinUrl}
              onChange={(event) => onJoinUrl(event.target.value)}
              placeholder="https://meet.google.com/…"
              className="stayo-commercial-input"
              aria-invalid={!validJoinUrl}
            />
            {!validJoinUrl && (
              <p className="mt-1 text-xs text-[var(--stayo-danger)]">Use um link HTTPS válido.</p>
            )}
          </FormField>
        )}
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="button" onClick={onSubmit} disabled={!valid}>
          {busy && <Loader2 className="size-4 animate-spin" />} Salvar reunião
        </Button>
      </div>
    </div>
  );
}

function ActionForm({
  title,
  onTitle,
  dueAtLocal,
  onDueAtLocal,
  timeZone,
  onTimeZone,
  responsible,
  onResponsible,
  assignees,
  busy,
  valid,
  onCancel,
  onSubmit,
}: {
  title: string;
  onTitle: (value: string) => void;
  dueAtLocal: string;
  onDueAtLocal: (value: string) => void;
  timeZone: string;
  onTimeZone: (value: string) => void;
  responsible: string;
  onResponsible: (value: string) => void;
  assignees: CommercialAssignee[];
  busy: boolean;
  valid: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-bg)] p-4">
      <h3 className="text-sm font-semibold text-[var(--stayo-ink)]">Definir próxima ação</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Ação">
          <input
            value={title}
            maxLength={180}
            onChange={(event) => onTitle(event.target.value)}
            placeholder="Ex.: Confirmar disponibilidade do proprietário"
            className="stayo-commercial-input"
          />
        </FormField>
        <FormField label="Prazo">
          <input
            type="datetime-local"
            value={dueAtLocal}
            onChange={(event) => onDueAtLocal(event.target.value)}
            className="stayo-commercial-input"
          />
        </FormField>
        <TimeZoneField value={timeZone} onChange={onTimeZone} />
        <AssigneeField value={responsible} onChange={onResponsible} assignees={assignees} />
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="button" onClick={onSubmit} disabled={!valid}>
          {busy && <Loader2 className="size-4 animate-spin" />} Salvar próxima ação
        </Button>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--stayo-ink-muted)]">
      {label}
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block font-normal leading-4">{hint}</span>}
    </label>
  );
}

function TimeZoneField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <FormField label="Fuso horário">
      <input
        list="stayo-commercial-timezones"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="stayo-commercial-input"
      />
      <datalist id="stayo-commercial-timezones">
        {timeZones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </FormField>
  );
}

function AssigneeField({
  value,
  onChange,
  assignees,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  assignees: CommercialAssignee[];
  required?: boolean;
}) {
  return (
    <FormField label={`Responsável${required ? "" : " (opcional)"}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="stayo-commercial-input"
      >
        {!required && <option value="">Sem responsável específico</option>}
        {assignees.map((person) => (
          <option key={person.id} value={person.id}>
            {person.fullName}
          </option>
        ))}
      </select>
    </FormField>
  );
}
