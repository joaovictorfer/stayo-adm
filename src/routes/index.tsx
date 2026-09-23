import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Building,
  CalendarCheck,
  ClipboardCheck,
  Clock3,
  DoorOpen,
  LogOut as DepartureIcon,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";

import {
  AdminAttentionCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth/session";
import {
  contractsListQuery,
  implementationItemsQuery,
  implementationsListQuery,
  inspectionsListQuery,
  operationTasksListQuery,
  propertiesListQuery,
  reservationsListQuery,
} from "@/lib/api/queries";
import { contractsExpiringWithin } from "@/lib/contract-status";
import { computeProgress, computeReadiness, statusLabels } from "@/lib/implementation-status";
import type { ImplementationItem, ImplementationProject, OperationTask } from "@/types/core";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Stayo Admin" },
      { name: "description", content: "Prioridades e operação diária do Stayo Admin." },
      { property: "og:title", content: "Dashboard — Stayo Admin" },
      { property: "og:description", content: "Prioridades e operação diária do Stayo Admin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const today = new Date().toISOString().slice(0, 10);
const todayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};
const isOpen = (status: string) => !["concluido", "concluida", "cancelado", "cancelada"].includes(status.toLowerCase());
const isLate = (task: OperationTask) => Boolean(task.dueDate && task.dueDate < today && isOpen(task.status));
const implementationPriority = (implementation: ImplementationProject) => !["ativo", "cancelado", "nao_convertido"].includes(implementation.status);

function DashboardPage() {
  const auth = useAuthSession();
  const properties = useQuery(propertiesListQuery());
  const reservations = useQuery(reservationsListQuery());
  const implementations = useQuery(implementationsListQuery());
  const inspections = useQuery(inspectionsListQuery());
  const operationTasks = useQuery(operationTasksListQuery());
  const contracts = useQuery(contractsListQuery());

  const implementationRows = implementations.data?.data ?? [];
  const itemsQueries = useQueries({ queries: implementationRows.map((item) => implementationItemsQuery(item.id)) });
  const itemsByImplementation = new Map<string, ImplementationItem[]>();
  implementationRows.forEach((item, index) => itemsByImplementation.set(item.id, (itemsQueries[index]?.data as ImplementationItem[] | undefined) ?? []));

  const reservationRows = reservations.data?.data ?? [];
  const taskRows = operationTasks.data?.data ?? [];
  const inspectionRows = inspections.data?.data ?? [];
  const arrivals = reservationRows.filter((item) => item.checkin === today);
  const departures = reservationRows.filter((item) => item.checkout === today);
  const todayTasks = taskRows.filter((item) => item.dueDate === today && isOpen(item.status)).sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99"));
  const cleanings = todayTasks.filter((item) => item.kind.toLowerCase().includes("limpeza"));
  const pendingCheckins = arrivals.filter((item) => item.webCheckin === "pendente");
  const todayInspections = inspectionRows.filter((item) => item.scheduledFor === today && isOpen(item.status));
  const lateTasks = taskRows.filter(isLate);
  const unassignedTasks = taskRows.filter((item) => isOpen(item.status) && !item.responsibleUserId);
  const expiringContracts = contractsExpiringWithin(contracts.data?.data ?? [], 60);
  const relevantImplementations = implementationRows.filter(implementationPriority).slice(0, 4);
  const blockedImplementations = implementationRows.filter((item) => computeReadiness(itemsByImplementation.get(item.id) ?? []).state === "bloqueada");
  const firstName = auth.status === "authenticated" ? auth.profile?.fullName.split(" ")[0] ?? "Victor" : "Victor";
  const attentionCount = lateTasks.length + unassignedTasks.length + todayInspections.length + expiringContracts.length + blockedImplementations.length;

  return (
    <div className="space-y-7">
      <AdminPageHeader
        eyebrow={todayLabel}
        title={`${greeting()}, ${firstName}`}
        description="Acompanhe a operação e o que exige sua atenção hoje."
        actions={<><Button asChild variant="outline"><Link to="/operacao">Ver operação</Link></Button><Button asChild className="admin-action-button"><Link to="/implantacao">Nova implantação</Link></Button></>}
      />

      <AdminSection title="Hoje" description="Movimentações e rotinas previstas para a data atual.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard icon={DoorOpen} label="Chegadas" value={reservations.isPending ? "—" : arrivals.length} detail={arrivals.length ? "reservas com entrada hoje" : "Nenhuma chegada prevista"} />
          <AdminStatCard icon={DepartureIcon} label="Saídas" value={reservations.isPending ? "—" : departures.length} detail={departures.length ? "reservas com saída hoje" : "Nenhuma saída prevista"} />
          <AdminStatCard icon={Sparkles} label="Limpezas" value={operationTasks.isPending ? "—" : cleanings.length} detail={cleanings.length ? "rotinas programadas" : "Nenhuma limpeza programada"} />
          <AdminStatCard icon={ClipboardCheck} label="Check-ins pendentes" value={reservations.isPending ? "—" : pendingCheckins.length} detail={pendingCheckins.length ? "aguardando conclusão" : "Nenhuma pendência de check-in"} tone={pendingCheckins.length ? "warning" : "success"} />
        </div>
      </AdminSection>

      <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <AdminSection title="Atenção necessária" description={attentionCount ? `${attentionCount} pontos precisam de acompanhamento.` : "Nenhum alerta prioritário agora."}>
          <div className="admin-panel p-3">
            {attentionCount === 0 ? <AdminEmptyState icon={ShieldAlert} title="Tudo sob controle por aqui" description="Novas pendências operacionais aparecerão nesta área." /> : <>
              {lateTasks.slice(0, 3).map((task) => <AdminAttentionCard key={`late-${task.id}`} tone="danger" title={task.title} description={`${task.propertyName ?? "Imóvel não informado"} · prazo ${task.dueDate}`} meta={<AdminStatusBadge tone="danger">Atrasada</AdminStatusBadge>} action={<Button asChild size="sm" variant="ghost"><Link to="/operacao/$id" params={{ id: task.id }}>Resolver <ArrowRight /></Link></Button>} />)}
              {blockedImplementations.slice(0, 2).map((item) => <AdminAttentionCard key={`blocked-${item.id}`} tone="danger" title={`${item.code} · ${item.ownerName ?? "Proprietário"}`} description="A implantação possui um bloqueador operacional em aberto." meta={<AdminStatusBadge tone="danger">Bloqueada</AdminStatusBadge>} action={<Button asChild size="sm" variant="ghost"><Link to="/implantacao/$id" params={{ id: item.id }}>Abrir <ArrowRight /></Link></Button>} />)}
              {todayInspections.slice(0, 2).map((item) => <AdminAttentionCard key={`inspection-${item.id}`} title="Vistoria pendente" description={`${item.propertyName ?? "Imóvel"} · prevista para hoje`} meta={<AdminStatusBadge tone="warning">Hoje</AdminStatusBadge>} action={<Button asChild size="sm" variant="ghost"><Link to="/vistorias/$id" params={{ id: item.id }}>Abrir <ArrowRight /></Link></Button>} />)}
              {expiringContracts.slice(0, 2).map((item) => <AdminAttentionCard key={`contract-${item.id}`} title={`Contrato ${item.code}`} description={`${item.ownerName ?? item.propertyName ?? "Contrato"} · vencimento ${item.endDate ?? "próximo"}`} meta={<AdminStatusBadge tone="warning">Vence em breve</AdminStatusBadge>} action={<Button asChild size="sm" variant="ghost"><Link to="/contratos/$id" params={{ id: item.id }}>Revisar <ArrowRight /></Link></Button>} />)}
              {unassignedTasks.filter((task) => !lateTasks.some((late) => late.id === task.id)).slice(0, 2).map((task) => <AdminAttentionCard key={`unassigned-${task.id}`} tone="info" title={task.title} description={`${task.propertyName ?? "Imóvel não informado"} · sem responsável definido`} meta={<AdminStatusBadge tone="info">Atribuir</AdminStatusBadge>} action={<Button asChild size="sm" variant="ghost"><Link to="/operacao/$id" params={{ id: task.id }}>Abrir <ArrowRight /></Link></Button>} />)}
            </>}
          </div>
        </AdminSection>

        <AdminSection title="Operação do dia" description="Agenda organizada por horário.">
          <div className="admin-panel">
            {todayTasks.length === 0 ? <AdminEmptyState icon={CalendarCheck} title="Sem rotinas programadas hoje" description="A agenda aparecerá aqui quando houver atividades para a data." /> : <div>{todayTasks.slice(0, 7).map((task) => <Link key={task.id} to="/operacao/$id" params={{ id: task.id }} className="admin-data-row"><span className="w-12 shrink-0 font-semibold text-[var(--admin-primary)]">{task.scheduledTime ?? "—"}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{task.title}</strong><small className="block truncate text-[var(--admin-muted)]">{task.propertyName ?? "Imóvel não informado"}</small></span><AdminStatusBadge tone={task.priority === "alta" ? "danger" : "neutral"}>{task.status}</AdminStatusBadge></Link>)}</div>}
          </div>
        </AdminSection>
      </div>

      <AdminSection title="Implantações em andamento" description="Etapa atual, avanço do checklist e próximo foco." action={<Button asChild variant="ghost" size="sm"><Link to="/implantacao">Ver todas <ArrowRight /></Link></Button>}>
        {relevantImplementations.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={Wrench} title="Nenhuma implantação em andamento" description="Quando uma oportunidade for criada, o acompanhamento aparecerá aqui." action={<Button asChild size="sm"><Link to="/implantacao">Criar implantação</Link></Button>} /></div> : <div className="grid gap-3 lg:grid-cols-2">{relevantImplementations.map((item) => {
          const progress = computeProgress(itemsByImplementation.get(item.id) ?? []);
          const readiness = computeReadiness(itemsByImplementation.get(item.id) ?? []);
          return <Link key={item.id} to="/implantacao/$id" params={{ id: item.id }} className="admin-panel block p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--admin-shadow-md)]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--admin-primary)]">{item.code}</p><h3 className="mt-1 font-semibold text-[var(--admin-text)]">{[item.condominiumName, item.unit].filter(Boolean).join(" · ") || item.nickname || item.ownerName || "Implantação"}</h3><p className="mt-1 text-xs text-[var(--admin-muted)]">{item.ownerName ?? "Proprietário a confirmar"}</p></div><AdminStatusBadge tone={readiness.state === "bloqueada" ? "danger" : readiness.state === "com_pendencias" ? "warning" : "info"}>{statusLabels[item.status]}</AdminStatusBadge></div><div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-subtle)]"><span className="block h-full rounded-full bg-[var(--admin-primary)]" style={{ width: `${progress.percent}%` }} /></div><span className="text-xs font-semibold text-[var(--admin-text)]">{progress.percent}%</span></div><div className="mt-3 flex items-center justify-between text-xs text-[var(--admin-muted)]"><span>{progress.total ? `${progress.total - progress.done} itens restantes` : "Checklist ainda não configurado"}</span><span className="admin-inline-link">Abrir <ArrowRight /></span></div></Link>;
        })}</div>}
      </AdminSection>

      <AdminSection title="Portfólio" description="Indicadores secundários da operação.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard icon={Building} label="Imóveis ativos" value={properties.isPending ? "—" : (properties.data?.data ?? []).filter((item) => item.status.toLowerCase() === "ativo").length} detail="na operação atual" />
          <AdminStatCard icon={CalendarCheck} label="Reservas" value={reservations.isPending ? "—" : reservationRows.length} detail="no período disponível" />
          <AdminStatCard icon={Wrench} label="Implantações" value={implementations.isPending ? "—" : relevantImplementations.length} detail="em acompanhamento" />
          <AdminStatCard icon={AlertTriangle} label="Pendências" value={operationTasks.isPending ? "—" : taskRows.filter((item) => isOpen(item.status)).length} detail="rotinas ainda abertas" tone={taskRows.some(isLate) ? "warning" : "neutral"} />
        </div>
      </AdminSection>
    </div>
  );
}
