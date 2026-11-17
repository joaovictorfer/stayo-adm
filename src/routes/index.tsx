import { localISODate } from "@/lib/local-date";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  Building2,
  ChevronRight,
  DoorOpen,
  LogOut as DepartureIcon,
  Sparkles,
  Plus,
  Wrench,
} from "lucide-react";

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { listImplementationCoverUrls } from "@/lib/api/implementation-covers";
import { PayoutPropertyPhoto } from "@/components/admin/PayoutPropertyPicker";
import { DashboardPayoutPanel } from "@/components/admin/DashboardPayoutPanel";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth/session";
import {
  implementationItemsQuery,
  implementationsListQuery,
  operationTasksListQuery,
  reservationsListQuery,
} from "@/lib/api/queries";
import { computeProgress, statusLabels } from "@/lib/implementation-status";
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

const today = localISODate();
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
  const operatingCount = implementationRows.filter(isPropertyOperating).length;
  const relevantImplementations = implementationRows.filter(implementationPriority).slice(0, 5);
  const payoutProperties = implementationRows.filter((item) =>
    isPayoutPropertyEligible({ status: item.status, core_property_id: item.corePropertyId ?? null }),
  );
  const coverIds = implementationRows.map((item) => item.id);
  const covers = useQuery({ queryKey: ["payout", "covers", coverIds], enabled: coverIds.length > 0, queryFn: () => listImplementationCoverUrls(coverIds), staleTime: 30 * 60 * 1000 });
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
        description={todayLabel}
        title={`${greeting()}, ${firstName}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/operacao"><CalendarDays /> Ver operação</Link>
            </Button>
            <Button asChild className="admin-action-button">
              <Link to="/implantacao"><Plus /> Nova implantação</Link>
            </Button>
          </>
        }
      />

      <div className="dashboard-metrics grid grid-cols-2 gap-3 xl:grid-cols-4">
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
          tone="danger"
        />
        <AdminStatCard
          icon={Sparkles}
          label="Limpezas"
          value={operationTasks.isPending ? "—" : cleanings.length}
          detail={cleanings.length ? "rotinas programadas" : "Nenhuma limpeza programada"}
          tone="warning"
        />
        <AdminStatCard
          icon={Building2}
          label="Em operação"
          value={implementations.isPending ? "—" : operatingCount}
          detail="Imóveis em operação"
          tone="success"
        />
      </div>

      <div className="dashboard-columns grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(330px,0.85fr)_minmax(0,1.35fr)]">
        <aside className="grid min-w-0 content-start gap-6 max-lg:order-2">
          <DashboardPayoutPanel covers={covers.data ?? {}} properties={payoutProperties.map((item) => ({ id: item.id, code: item.code, nickname: item.nickname, condominium_name: item.condominiumName, unit: item.unit }))} />

          <AdminSection
            title="Implantação em andamento"
            className="dashboard-implementations"
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
              <div className="dashboard-implementation-list">
                {relevantImplementations.map((item) => {
                  const progress = computeProgress(itemsByImplementation.get(item.id) ?? []);
                  
                  return (
                    <Link
                      key={item.id}
                      to="/implantacao/$id"
                      params={{ id: item.id }}
                      className="dashboard-implementation block"
                    >
                      <div className="dashboard-implementation-identity">
                        <PayoutPropertyPhoto url={covers.data?.[item.id]} name={[item.condominiumName, item.unit].filter(Boolean).join(" ")} />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-[var(--admin-text)]">
                            {item.nickname?.trim() || [item.condominiumName, item.unit].filter(Boolean).join(" ") || item.ownerName || "Implantação"}
                          </h3>
                          <p className="mt-0.5 truncate text-xs text-[var(--admin-muted)]">
                            {statusLabels[item.status]}
                          </p>
                        </div>
                        <ChevronRight className="dashboard-row-arrow size-4 shrink-0" />
                      </div>
                      <div className="dashboard-implementation-progress">
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
          description={`${agenda.length} movimentações programadas`}
          className="dashboard-agenda min-w-0 max-lg:order-1"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/operacao/agenda">
                Ver agenda completa <ArrowRight />
              </Link>
            </Button>
          }
        >
          <div className="dashboard-agenda-body">
            <div className="dashboard-agenda-columns" aria-hidden="true"><span>Horário</span><span>Imóvel / hóspede</span><span>Movimentação</span><span /></div>
            {agenda.length === 0 ? (
              <AdminEmptyState
                icon={CalendarCheck}
                title="Tudo tranquilo por hoje"
                description="Nenhuma chegada, saída ou rotina programada para hoje."
                action={<Button asChild variant="outline" size="sm"><Link to="/operacao/agenda">Abrir agenda <ArrowRight /></Link></Button>}
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
                        className="dashboard-agenda-row"
                      >
                        <span className="dashboard-agenda-time">
                          {task.scheduledTime ?? "—"}
                        </span>
                        <span className="dashboard-agenda-property">
                          <span className="dashboard-task-icon"><Sparkles className="size-4" /></span>
                          <span className="min-w-0"><strong className="block truncate text-sm">{task.title}</strong>
                          <small className="block truncate text-[var(--admin-muted)]">
                            {task.propertyName ?? "Imóvel não informado"}
                          </small></span>
                        </span>
                        <AdminStatusBadge tone={task.priority === "alta" ? "danger" : "neutral"}>
                          {task.status}
                        </AdminStatusBadge>
                        <ChevronRight className="dashboard-row-arrow size-4" />
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
                      className="dashboard-agenda-row"
                    >
                      <span className="dashboard-agenda-time">
                        {entry.time || "—"}
                      </span>
                      <span className="dashboard-agenda-property">
                        <PayoutPropertyPhoto url={covers.data?.[implementationRows.find((p) => p.corePropertyId === reservation.propertyId)?.id ?? ""]} name={reservation.propertyName ?? "Imóvel"} />
                        <span className="min-w-0"><strong className="block truncate text-sm">
                          {reservation.propertyName ?? "Imóvel não informado"}
                        </strong>
                        <small className="block truncate text-[var(--admin-muted)]">
                          {reservation.guestName ?? "Hóspede a confirmar"}
                          {reservation.channel ? ` · ${reservation.channel}` : ""}
                        </small></span>
                      </span>
                      <AdminStatusBadge tone={isArrival ? "info" : "warning"}>
                        {isArrival ? <DoorOpen className="size-3.5" /> : <DepartureIcon className="size-3.5" />}{isArrival ? "Chegada" : "Saída"}
                      </AdminStatusBadge>
                      <ChevronRight className="dashboard-row-arrow size-4" />
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
