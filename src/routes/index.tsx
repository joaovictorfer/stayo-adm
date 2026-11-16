import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  DoorOpen,
  LogOut as DepartureIcon,
  Sparkles,
  Wrench,
} from "lucide-react";

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { DashboardPayoutPanel } from "@/components/admin/DashboardPayoutPanel";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth/session";
import {
  implementationItemsQuery,
  implementationsListQuery,
  operationTasksListQuery,
  reservationsListQuery,
} from "@/lib/api/queries";
import { computeProgress, computeReadiness, statusLabels } from "@/lib/implementation-status";
import { isPropertyImplementing, isPropertyOperating } from "@/lib/property-operation";
import { isPayoutPropertyEligible } from "@/lib/payout-properties";
import type { ImplementationItem, ImplementationProject, OperationTask, Reservation } from "@/types/core";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Stayo Admin" },
      { name: "description", content: "Agenda do dia, repasses e implantações do Stayo Admin." },
      { property: "og:title", content: "Dashboard — Stayo Admin" },
      { property: "og:description", content: "Agenda do dia, repasses e implantações do Stayo Admin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const today = new Date().toISOString().slice(0, 10);
const todayLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
}).format(new Date());
const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};
const isOpen = (status: string) =>
  !["concluido", "concluida", "cancelado", "cancelada"].includes(status.toLowerCase());
const implementationPriority = (implementation: ImplementationProject) =>
  isPropertyImplementing(implementation) && !["cancelado", "nao_convertido"].includes(implementation.status);

type AgendaEntry =
  | { kind: "task"; time: string; task: OperationTask }
  | { kind: "arrival" | "departure"; time: string; reservation: Reservation };

function DashboardPage() {
  const auth = useAuthSession();
  const reservations = useQuery(reservationsListQuery());
  const implementations = useQuery(implementationsListQuery());
  const operationTasks = useQuery(operationTasksListQuery());

  const implementationRows = implementations.data?.data ?? [];
  const itemsQueries = useQueries({
    queries: implementationRows.map((item) => implementationItemsQuery(item.id)),
  });
  const itemsByImplementation = new Map<string, ImplementationItem[]>();
  implementationRows.forEach((item, index) =>
    itemsByImplementation.set(
      item.id,
      (itemsQueries[index]?.data as ImplementationItem[] | undefined) ?? [],
    ),
  );

  const reservationRows = reservations.data?.data ?? [];
  const taskRows = operationTasks.data?.data ?? [];
  const arrivals = reservationRows.filter((item) => item.checkin === today);
  const departures = reservationRows.filter((item) => item.checkout === today);
  const todayTasks = taskRows
    .filter((item) => item.dueDate === today && isOpen(item.status))
    .sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99"));
  const cleanings = todayTasks.filter((item) => item.kind.toLowerCase().includes("limpeza"));
  const pendingCheckins = arrivals.filter((item) => item.webCheckin === "pendente");
  const operatingCount = implementationRows.filter(isPropertyOperating).length;
  const relevantImplementations = implementationRows.filter(implementationPriority).slice(0, 5);
  const payoutProperties = implementationRows.filter((item) =>
    isPayoutPropertyEligible({ status: item.status, core_property_id: item.corePropertyId ?? null }),
  );
  const firstName =
    auth.status === "authenticated" ? (auth.profile?.fullName.split(" ")[0] ?? "Victor") : "Victor";

  const agenda: AgendaEntry[] = [
    ...todayTasks.map((task) => ({ kind: "task" as const, time: task.scheduledTime ?? "", task })),
    ...arrivals.map((reservation) => ({
      kind: "arrival" as const,
      time: reservation.expectedArrivalTime ?? "",
      reservation,
    })),
    ...departures.map((reservation) => ({ kind: "departure" as const, time: "", reservation })),
  ].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  return (
    <div className="admin-dashboard space-y-6">
      <AdminPageHeader
        eyebrow={todayLabel}
        title={`${greeting()}, ${firstName}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/operacao">Ver operação</Link>
            </Button>
            <Button asChild className="admin-action-button">
              <Link to="/implantacao">Nova implantação</Link>
            </Button>
          </>
        }
      />

      <div className="dashboard-metrics grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={DoorOpen}
          label="Chegadas"
          value={reservations.isPending ? "—" : arrivals.length}
          detail={arrivals.length ? "reservas com entrada hoje" : "Nenhuma chegada prevista"}
          tone="info"
        />
        <AdminStatCard
          icon={DepartureIcon}
          label="Saídas"
          value={reservations.isPending ? "—" : departures.length}
          detail={departures.length ? "reservas com saída hoje" : "Nenhuma saída prevista"}
          tone="warning"
        />
        <AdminStatCard
          icon={Sparkles}
          label="Limpezas"
          value={operationTasks.isPending ? "—" : cleanings.length}
          detail={cleanings.length ? "rotinas programadas" : "Nenhuma limpeza programada"}
          tone="success"
        />
        <AdminStatCard
          icon={ClipboardCheck}
          label="Check-ins pendentes"
          value={reservations.isPending ? "—" : pendingCheckins.length}
          detail={
            pendingCheckins.length ? "aguardando conclusão" : "Nenhuma pendência de check-in"
          }
          tone={pendingCheckins.length ? "warning" : "success"}
        />
      </div>

      <div className="dashboard-columns grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)]">
        <aside className="grid min-w-0 content-start gap-6 max-lg:order-2">
          <DashboardPayoutPanel properties={payoutProperties} />

          <AdminSection
            title="Implantação em andamento"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/implantacao">
                  Ver todas <ArrowRight />
                </Link>
              </Button>
            }
          >
            {relevantImplementations.length === 0 ? (
              <div className="admin-panel">
                <AdminEmptyState
                  icon={Wrench}
                  title="Nenhuma implantação em andamento"
                  description="Quando uma oportunidade for criada, o acompanhamento aparecerá aqui."
                />
              </div>
            ) : (
              <div className="grid gap-2.5">
                {relevantImplementations.map((item) => {
                  const progress = computeProgress(itemsByImplementation.get(item.id) ?? []);
                  const readiness = computeReadiness(itemsByImplementation.get(item.id) ?? []);
                  return (
                    <Link
                      key={item.id}
                      to="/implantacao/$id"
                      params={{ id: item.id }}
                      className="dashboard-implementation admin-panel block p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-[var(--admin-text)]">
                            {[item.condominiumName, item.unit].filter(Boolean).join(" · ") ||
                              item.nickname ||
                              item.ownerName ||
                              "Implantação"}
                          </h3>
                          <p className="mt-0.5 truncate text-xs text-[var(--admin-muted)]">
                            {item.ownerName ?? "Proprietário a confirmar"}
                          </p>
                        </div>
                        <AdminStatusBadge
                          tone={
                            readiness.state === "bloqueada"
                              ? "danger"
                              : readiness.state === "com_pendencias"
                                ? "warning"
                                : "info"
                          }
                        >
                          {statusLabels[item.status]}
                        </AdminStatusBadge>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-subtle)]">
                          <span
                            className="block h-full rounded-full bg-[var(--admin-primary)]"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-[var(--admin-text)]">
                          {progress.percent}%
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </AdminSection>
        </aside>

        <AdminSection
          title="Agenda de hoje"
          className="dashboard-agenda min-w-0 max-lg:order-1"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/operacao/agenda">
                Ver agenda completa <ArrowRight />
              </Link>
            </Button>
          }
        >
          <div className="admin-panel">
            {agenda.length === 0 ? (
              <AdminEmptyState
                icon={CalendarCheck}
                title="Sem movimentações hoje"
                description="Chegadas, saídas e rotinas aparecerão aqui quando houver atividades para a data."
              />
            ) : (
              <div>
                {agenda.map((entry) => {
                  if (entry.kind === "task") {
                    const { task } = entry;
                    return (
                      <Link
                        key={`task-${task.id}`}
                        to="/operacao/$id"
                        params={{ id: task.id }}
                        className="admin-data-row"
                      >
                        <span className="w-12 shrink-0 font-semibold tabular-nums text-[var(--admin-primary)]">
                          {task.scheduledTime ?? "—"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">{task.title}</strong>
                          <small className="block truncate text-[var(--admin-muted)]">
                            {task.propertyName ?? "Imóvel não informado"}
                          </small>
                        </span>
                        <AdminStatusBadge tone={task.priority === "alta" ? "danger" : "neutral"}>
                          {task.status}
                        </AdminStatusBadge>
                      </Link>
                    );
                  }
                  const { reservation } = entry;
                  const isArrival = entry.kind === "arrival";
                  return (
                    <Link
                      key={`${entry.kind}-${reservation.id}`}
                      to="/reservas/$id"
                      params={{ id: reservation.id }}
                      className="admin-data-row"
                    >
                      <span className="w-12 shrink-0 font-semibold tabular-nums text-[var(--admin-primary)]">
                        {entry.time || "—"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">
                          {reservation.propertyName ?? "Imóvel não informado"}
                        </strong>
                        <small className="block truncate text-[var(--admin-muted)]">
                          {reservation.guestName ?? "Hóspede a confirmar"}
                          {reservation.channel ? ` · ${reservation.channel}` : ""}
                        </small>
                      </span>
                      <AdminStatusBadge tone={isArrival ? "info" : "warning"}>
                        {isArrival ? "Chegada" : "Saída"}
                      </AdminStatusBadge>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </AdminSection>
      </div>
    </div>
  );
}
