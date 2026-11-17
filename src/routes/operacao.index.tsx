import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ChevronRight, Clock3, DollarSign, ListChecks, LogIn, LogOut, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { OpTaskDialog } from "@/components/admin/OpTaskDialog";
import { kindLabel, taskDone, useBoardTasks } from "@/components/admin/TaskBoard";
import { Button } from "@/components/ui/button";
import type { BoardTask } from "@/lib/api/op-tasks";
import { opMovementsQuery } from "@/lib/api/op-movements-api";
import { addDaysISO, localISODate, longDayLabel } from "@/lib/local-date";

export const Route = createFileRoute("/operacao/")({
  head: () => ({ meta: [
    { title: "Central operacional — Stayo Admin" },
    { name: "description", content: "Resumo do dia: entradas, saídas, viradas, tarefas atrasadas e próximos dias." },
    { property: "og:title", content: "Central operacional — Stayo Admin" },
    { property: "og:description", content: "Resumo do dia: entradas, saídas, viradas, tarefas atrasadas e próximos dias." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OperationPage,
});

const shortDay = (iso: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

function OperationPage() {
  const today = localISODate();
  const weekEnd = addDaysISO(today, 6);
  const { rows, pending, coreError } = useBoardTasks();
  const moves = useQuery(opMovementsQuery(today, weekEnd));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BoardTask | null>(null);

  const d = (t: BoardTask) => t.dueDate?.slice(0, 10) ?? "";
  const openTasks = rows.filter((t) => !taskDone(t));
  const todayTasks = rows.filter((t) => d(t) === today);
  const late = openTasks.filter((t) => d(t) && d(t) < today).sort((a, b) => d(a).localeCompare(d(b)));
  const unassigned = openTasks.filter((t) => d(t) >= today && d(t) <= weekEnd && !t.responsibleUserId && !t.responsibleName).length;
  const movesToday = (moves.data ?? []).filter((m) => m.date === today);
  const outsToday = movesToday.filter((m) => m.type === "checkout");
  const critical = outsToday.filter((m) => m.turnover === "mesmo_dia").length;

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const day = addDaysISO(today, i);
    const ms = (moves.data ?? []).filter((m) => m.date === day);
    return { day, outs: ms.filter((m) => m.type === "checkout").length, ins: ms.filter((m) => m.type === "checkin").length,
      tasks: openTasks.filter((t) => d(t) === day).length, critical: ms.some((m) => m.turnover === "mesmo_dia") };
  }), [moves.data, openTasks, today]);

  const edit = (t: BoardTask) => { setEditing(t); setOpen(true); };

  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Operação" title="Central operacional" description={`${longDayLabel(today)} · o que precisa acontecer hoje e nos próximos dias.`}
      actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" />Nova tarefa</Button>} />

    <div className="portfolio-metrics">
      <PortfolioMetric icon={LogOut} value={outsToday.length} label="Saídas hoje (limpeza)" tone="info" />
      <PortfolioMetric icon={LogIn} value={movesToday.length - outsToday.length} label="Entradas hoje" tone="info" />
      <PortfolioMetric icon={AlertTriangle} value={critical} label="Viradas no mesmo dia" tone={critical ? "warning" : "success"} />
      <PortfolioMetric icon={ListChecks} value={todayTasks.filter((t) => !taskDone(t)).length} label="Tarefas de hoje" tone="neutral" />
      <PortfolioMetric icon={Clock3} value={late.length} label="Atrasadas" tone={late.length ? "warning" : "success"} />
      <PortfolioMetric icon={Users} value={unassigned} label="Sem responsável (7 dias)" tone={unassigned ? "warning" : "success"} />
    </div>
    {coreError && <p className="text-xs text-[var(--admin-muted)]">STAYO APP indisponível agora; mostrando tarefas do Admin e reservas já importadas.</p>}

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="admin-panel overflow-hidden">
        <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
          <h2 className="font-[var(--stayo-font-display)] text-base">Hoje</h2>
          <Link to="/operacao/agenda" className="text-xs font-medium text-[var(--admin-primary)] hover:underline">Abrir agenda</Link>
        </header>
        {pending || moves.isPending ? <p className="p-5 text-sm text-[var(--admin-muted)]">Carregando…</p>
          : movesToday.length + todayTasks.length === 0 ? <AdminEmptyState icon={CalendarDays} title="Dia tranquilo" description="Sem entradas, saídas ou tarefas para hoje." />
          : <ul className="divide-y divide-[var(--admin-border)]">
            {movesToday.map((m) => <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              {m.type === "checkout" ? <LogOut className="size-4 shrink-0 text-[var(--admin-warning)]" /> : <LogIn className="size-4 shrink-0 text-[var(--admin-primary)]" />}
              <span className="min-w-0 flex-1"><b className="block truncate text-sm">{m.type === "checkout" ? "Saída" : "Entrada"} · {m.property}</b><small className="block truncate text-[var(--admin-muted)]">{m.guest ?? "Hóspede não informado"}</small></span>
              {m.turnover === "mesmo_dia" && <AdminStatusBadge tone="danger">Virada</AdminStatusBadge>}
              {m.turnover === "dia_seguinte" && <AdminStatusBadge tone="warning">Entrada amanhã</AdminStatusBadge>}
            </li>)}
            {todayTasks.map((t) => <li key={t.id}><TaskLine t={t} onEdit={edit} /></li>)}
          </ul>}
      </section>

      <div className="space-y-4">
        <section className="admin-panel overflow-hidden">
          <header className="border-b border-[var(--admin-border)] px-4 py-3"><h2 className="font-[var(--stayo-font-display)] text-base">Próximos 7 dias</h2></header>
          <ul className="divide-y divide-[var(--admin-border)]">{week.map((w) => <li key={w.day} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-16 shrink-0 capitalize text-[var(--admin-muted)]">{w.day === today ? "Hoje" : shortDay(w.day)}</span>
            <span className="flex flex-1 flex-wrap gap-x-3 gap-y-0.5 text-xs"><span>{w.outs} saída{w.outs === 1 ? "" : "s"}</span><span>{w.ins} entrada{w.ins === 1 ? "" : "s"}</span><span>{w.tasks} tarefa{w.tasks === 1 ? "" : "s"}</span></span>
            {w.critical && <AdminStatusBadge tone="danger">Virada</AdminStatusBadge>}
          </li>)}</ul>
        </section>

        <section className="admin-panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
            <h2 className="font-[var(--stayo-font-display)] text-base">Atrasadas</h2>
            <Link to="/operacao/tarefas" className="text-xs font-medium text-[var(--admin-primary)] hover:underline">Ver tarefas</Link>
          </header>
          {late.length === 0 ? <p className="px-4 py-4 text-sm text-[var(--admin-muted)]">Nenhuma tarefa atrasada.</p>
            : <ul className="divide-y divide-[var(--admin-border)]">{late.slice(0, 6).map((t) => <li key={t.id}><TaskLine t={t} onEdit={edit} showDate /></li>)}</ul>}
        </section>

        <nav aria-label="Atalhos da operação" className="grid grid-cols-2 gap-2">
          {([{ to: "/operacao/equipe", label: "Equipe e Meu Dia", icon: Users }, { to: "/operacao/custos", label: "Custos do mês", icon: DollarSign }] as const).map((l) =>
            <Link key={l.to} to={l.to} className="admin-panel flex items-center gap-2 px-3 py-3 text-sm font-medium hover:bg-[var(--admin-surface-subtle)]"><l.icon className="size-4 text-[var(--admin-primary)]" />{l.label}</Link>)}
        </nav>
      </div>
    </div>
    <OpTaskDialog open={open} onOpenChange={setOpen} task={editing} defaultDate={today} />
  </div>;
}

function TaskLine({ t, onEdit, showDate }: { t: BoardTask; onEdit: (t: BoardTask) => void; showDate?: boolean }) {
  const inner = <>
    <span className="w-12 shrink-0 text-sm tabular-nums text-[var(--admin-primary)]">{showDate && t.dueDate ? `${t.dueDate.slice(8, 10)}/${t.dueDate.slice(5, 7)}` : t.scheduledTime?.slice(0, 5) ?? "—"}</span>
    <span className="min-w-0 flex-1"><b className="block truncate text-sm">{t.title}</b><small className="block truncate text-[var(--admin-muted)]">{kindLabel(t.kind)} · {t.propertyName ?? "Imóvel não informado"}</small></span>
    <AdminStatusBadge tone={taskDone(t) ? "success" : t.status === "em_andamento" ? "info" : "neutral"}>{taskDone(t) ? "Concluída" : t.status === "em_andamento" ? "Em andamento" : "Pendente"}</AdminStatusBadge>
    <ChevronRight className="hidden size-4 text-[var(--admin-muted)] sm:block" />
  </>;
  const cls = "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--admin-surface-subtle)]";
  return t.source === "admin" ? <button type="button" className={cls} onClick={() => onEdit(t)}>{inner}</button>
    : <Link to="/operacao/$id" params={{ id: t.id }} className={cls}>{inner}</Link>;
}
