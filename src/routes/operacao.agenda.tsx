import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Clock3, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { Button } from "@/components/ui/button";
import { operationTasksListQuery } from "@/lib/api/queries";

export const Route = createFileRoute("/operacao/agenda")({
  head: () => ({ meta: [
    { title: "Agenda operacional — Stayo Admin" },
    { name: "description", content: "Agenda diária e semanal da operação Stayo." },
    { property: "og:title", content: "Agenda operacional — Stayo Admin" },
    { property: "og:description", content: "Agenda diária e semanal da operação Stayo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AgendaPage,
});

type View = "dia" | "semana" | "imovel";
const today = new Date().toISOString().slice(0, 10);

function AgendaPage() {
  const query = useQuery(operationTasksListQuery());
  const [view, setView] = useState<View>("dia");
  const [date, setDate] = useState(today);
  const rows = query.data?.data ?? [];
  const visible = useMemo(() => view === "dia" ? rows.filter((row) => row.dueDate === date) : rows, [rows, view, date]);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof visible>();
    for (const row of visible) {
      const key = view === "imovel" ? (row.propertyName ?? "Sem imóvel") : (row.dueDate ?? "Sem data");
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [visible, view]);
  const pending = rows.filter((row) => !row.status.toLowerCase().includes("conclu")).length;
  const unassigned = rows.filter((row) => !row.responsibleUserId).length;

  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Operação" title="Agenda operacional" description="Serviços, vistorias e rotinas organizados por horário e imóvel."
      actions={<input aria-label="Data da agenda" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="admin-input h-10 px-3 text-sm" />} />
    <div className="portfolio-metrics">
      <PortfolioMetric icon={CalendarDays} value={rows.length} label="Eventos no período" tone="info" />
      <PortfolioMetric icon={ListChecks} value={pending} label="Pendentes" tone={pending ? "warning" : "success"} />
      <PortfolioMetric icon={Clock3} value={unassigned} label="Sem responsável" tone={unassigned ? "warning" : "success"} />
    </div>
    <ModuleTabs value={view} onChange={setView} options={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana" }, { value: "imovel", label: "Por imóvel" }]} />
    {query.isPending ? <div className="admin-panel p-5 text-sm text-[var(--admin-muted)]">Carregando agenda…</div>
      : query.isError ? <div className="admin-panel p-5"><AdminEmptyState title="Agenda indisponível" description="Nenhum evento é exibido para não parecer uma agenda vazia." /></div>
      : grouped.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={CalendarDays} title="Nada previsto para este período" description="Altere a data ou consulte a semana completa." /></div>
      : <div className="space-y-4">{grouped.map(([group, tasks]) => <section key={group} className="admin-panel overflow-hidden">
          <header className="border-b border-[var(--admin-border)] px-4 py-3"><h2 className="font-[var(--stayo-font-display)] text-lg capitalize">{group}</h2></header>
          <div className="divide-y divide-[var(--admin-border)]">{tasks.sort((a,b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99")).map((task) =>
            <Link key={task.id} to="/operacao/$id" params={{ id: task.id }} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-[var(--admin-surface-subtle)]">
              <strong className="text-sm text-[var(--admin-primary)]">{task.scheduledTime ?? "—"}</strong>
              <span className="min-w-0"><b className="block truncate text-sm">{task.title}</b><small className="block truncate text-[var(--admin-muted)]">{task.propertyName ?? "Imóvel não informado"}</small></span>
              <span className="flex items-center gap-2"><AdminStatusBadge tone={task.priority === "alta" ? "danger" : "neutral"}>{task.status}</AdminStatusBadge><ChevronRight className="hidden size-4 text-[var(--admin-muted)] sm:block" /></span>
            </Link>)}</div>
        </section>)}</div>}
    <p className="text-xs text-[var(--admin-muted)]">Somente leitura nesta fase. Atribuir, reagendar e concluir serão liberados pela integração controlada.</p>
    <Button asChild variant="outline"><Link to="/operacao">Voltar à Central operacional</Link></Button>
  </div>;
}