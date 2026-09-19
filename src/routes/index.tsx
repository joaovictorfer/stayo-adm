import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  FileWarning,
  House,
  ListTodo,
} from "lucide-react";

import { IndicatorCard } from "../components/patterns/IndicatorCard";
import {
  contractsListQuery,
  implementationsListQuery,
  inspectionsListQuery,
  operationTasksListQuery,
  propertiesListQuery,
  reservationsListQuery,
} from "../lib/api/queries";
import { contractsExpiringWithin } from "../lib/contract-status";
import type { OperationTask, Reservation } from "../types/core";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Stayo Admin" },
      { name: "description", content: "Situação operacional, prioridades e próximos movimentos da Stayo." },
      { property: "og:title", content: "Dashboard — Stayo Admin" },
      { property: "og:description", content: "Situação operacional, prioridades e próximos movimentos da Stayo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const today = new Date();
const todayISO = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
const todayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(today);

function DashboardPage() {
  const properties = useQuery(propertiesListQuery());
  const reservations = useQuery(reservationsListQuery());
  const implementations = useQuery(implementationsListQuery());
  const inspections = useQuery(inspectionsListQuery());
  const operationTasks = useQuery(operationTasksListQuery());
  const contracts = useQuery(contractsListQuery());

  const reservationRows = reservations.data?.data ?? [];
  const taskRows = operationTasks.data?.data ?? [];
  const inspectionRows = inspections.data?.data ?? [];
  const implementationRows = implementations.data?.data ?? [];
  const contractRows = contracts.data?.data ?? [];
  const arrivals = reservationRows.filter((item) => item.checkin === todayISO);
  const departures = reservationRows.filter((item) => item.checkout === todayISO);
  const tasksToday = taskRows.filter((item) => item.dueDate === todayISO);
  const overdueTasks = taskRows.filter((item) => item.dueDate && item.dueDate < todayISO && item.status === "pendente");
  const pendingInspections = inspectionRows.filter((item) => item.status !== "concluida" && item.status !== "cancelada");
  const expiringContracts = contractsExpiringWithin(contractRows, 60);
  const activeImplementations = implementationRows.filter((item) => !["ativo", "cancelado", "nao_convertido"].includes(item.status));
  const pendingCount = overdueTasks.length + pendingInspections.length + expiringContracts.length;
  const pending = reservations.isPending || operationTasks.isPending || inspections.isPending || contracts.isPending;

  return <div className="flex flex-col gap-6">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-premium">{todayLabel}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-3xl">Visão da operação</h1>
        <p className="mt-1 text-sm text-muted-foreground">Situação, atenção e próximos movimentos da equipe.</p>
      </div>
      <Link to="/operacao" className="hidden items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-brand-hover sm:flex">Ver operação <ArrowRight size={15} /></Link>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de hoje">
      <IndicatorCard icon={CalendarCheck} label="Chegadas hoje" value={reservations.isPending ? "—" : arrivals.length} />
      <IndicatorCard icon={CalendarClock} label="Saídas hoje" value={reservations.isPending ? "—" : departures.length} />
      <IndicatorCard icon={ListTodo} label="Pendências hoje" value={operationTasks.isPending ? "—" : tasksToday.length} tone={tasksToday.length ? "warning" : "neutral"} />
      <IndicatorCard icon={CircleAlert} label="Precisam de atenção" value={pending ? "—" : pendingCount} tone={pendingCount ? "warning" : "neutral"} />
    </section>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.75fr)]">
      <section className="min-w-0 rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]" style={{ borderColor: "var(--stayo-border)" }}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border px-5 py-4">
          <div className="min-w-0"><h2 className="font-display text-base font-semibold">Operação do dia</h2><p className="mt-0.5 text-xs text-muted-foreground">Chegadas e tarefas programadas</p></div>
          <span className="rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">{arrivals.length + tasksToday.length} eventos</span>
        </div>
        <div className="divide-y divide-border">
          {arrivals.map((item) => <ArrivalRow key={item.id} item={item} />)}
          {tasksToday.map((item) => <TaskRow key={item.id} item={item} />)}
          {!reservations.isPending && !operationTasks.isPending && arrivals.length + tasksToday.length === 0 && <EmptyDay />}
          {(reservations.isPending || operationTasks.isPending) && <div className="space-y-3 p-5">{[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>}
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]" style={{ borderColor: "var(--stayo-border)" }}>
        <div className="border-b border-border px-5 py-4"><h2 className="font-display text-base font-semibold">Painel de atenção</h2><p className="mt-0.5 text-xs text-muted-foreground">O que pode comprometer a operação</p></div>
        <div className="space-y-2 p-3">
          <AttentionLink to="/operacao" icon={ListTodo} label="Tarefas atrasadas" value={overdueTasks.length} loading={operationTasks.isPending} />
          <AttentionLink to="/vistorias" icon={ClipboardCheck} label="Vistorias pendentes" value={pendingInspections.length} loading={inspections.isPending} />
          <AttentionLink to="/contratos" icon={FileWarning} label="Contratos vencendo em 60d" value={expiringContracts.length} loading={contracts.isPending} />
        </div>
      </section>
    </div>

    <section>
      <div className="mb-3 flex items-end justify-between"><div><h2 className="font-display text-base font-semibold">Pulso da operação</h2><p className="text-xs text-muted-foreground">Base ativa e frentes em andamento</p></div></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <IndicatorCard icon={House} label="Imóveis" value={properties.isPending ? "—" : properties.data?.data.length ?? 0} />
        <IndicatorCard icon={ClipboardCheck} label="Implantações ativas" value={implementations.isPending ? "—" : activeImplementations.length} />
        <IndicatorCard icon={CalendarCheck} label="Reservas" value={reservations.isPending ? "—" : reservationRows.length} />
      </div>
    </section>
  </div>;
}

function ArrivalRow({ item }: { item: Reservation }) {
  return <Link to="/reservas/$id" params={{ id: item.id }} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 hover:bg-muted/60">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><CalendarCheck size={17} /></span>
    <div className="min-w-0"><p className="truncate text-sm font-semibold">Check-in · {item.guestName ?? "Hóspede"}</p><p className="truncate text-xs text-muted-foreground">{item.propertyName ?? "Imóvel não informado"}</p></div>
    <span className="text-xs font-semibold text-foreground">{item.expectedArrivalTime ?? "A confirmar"}</span>
  </Link>;
}

function TaskRow({ item }: { item: OperationTask }) {
  return <Link to="/operacao/$id" params={{ id: item.id }} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 hover:bg-muted/60">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-premium-soft text-premium"><ListTodo size={17} /></span>
    <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.title}</p><p className="truncate text-xs text-muted-foreground">{item.propertyName ?? item.kind}</p></div>
    <span className="text-xs font-semibold text-foreground">{item.scheduledTime ?? "Sem horário"}</span>
  </Link>;
}

function EmptyDay() {
  return <div className="px-6 py-12 text-center"><CalendarCheck size={25} className="mx-auto text-brand" /><p className="mt-3 font-display text-sm font-semibold">Agenda livre por enquanto</p><p className="mt-1 text-xs text-muted-foreground">Chegadas e tarefas aparecerão aqui quando forem recebidas pelo Core.</p></div>;
}

function AttentionLink({ to, icon: Icon, label, value, loading }: { to: "/operacao" | "/vistorias" | "/contratos"; icon: typeof ListTodo; label: string; value: number; loading: boolean }) {
  return <Link to={to} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted">
    <span className={`grid h-8 w-8 place-items-center rounded-lg ${value ? "bg-premium-soft text-premium" : "bg-muted text-muted-foreground"}`}><Icon size={16} /></span>
    <span className="min-w-0 truncate text-sm font-medium">{label}</span>
    <span className={`min-w-7 rounded-md px-2 py-1 text-center text-xs font-bold ${value ? "bg-premium-soft text-premium" : "bg-muted text-muted-foreground"}`}>{loading ? "—" : value}</span>
  </Link>;
}