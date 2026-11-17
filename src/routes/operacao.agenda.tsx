import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ListChecks, LogIn, LogOut, Plus } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { Button } from "@/components/ui/button";
import { SyncUpcomingButton } from "@/components/admin/SyncUpcomingButton";
import { OpTaskDialog } from "@/components/admin/OpTaskDialog";
import { kindLabel, taskDone, useBoardTasks } from "@/components/admin/TaskBoard";
import type { BoardTask } from "@/lib/api/op-tasks";
import { opMovementsQuery } from "@/lib/api/op-movements-api";
import { addDaysISO, localISODate, longDayLabel } from "@/lib/local-date";
import type { Movement } from "@/lib/op-movements";

export const Route = createFileRoute("/operacao/agenda")({
  head: () => ({ meta: [
    { title: "Agenda operacional — Stayo Admin" },
    { name: "description", content: "Agenda diária e semanal da operação Stayo, com entradas, saídas e viradas." },
    { property: "og:title", content: "Agenda operacional — Stayo Admin" },
    { property: "og:description", content: "Agenda diária e semanal da operação Stayo, com entradas, saídas e viradas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AgendaPage,
});

type View = "dia" | "semana" | "mes" | "imovel";
type Item = { kind: "task"; task: BoardTask } | { kind: "move"; move: Movement };
const statusText = (t: BoardTask) => taskDone(t) ? "Concluída" : t.status === "em_andamento" ? "Em andamento" : "Pendente";
const rowCls = "grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left";

function AgendaPage() {
  const today = localISODate();
  const { rows, pending: loading, coreError } = useBoardTasks();
  const [view, setView] = useState<View>("dia");
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const monthStart = date.slice(0, 8) + "01";
  const monthEnd = addDaysISO(addDaysISO(monthStart, 32).slice(0, 8) + "01", -1);
  const start = view === "mes" ? monthStart : date;
  const end = view === "semana" ? addDaysISO(date, 6) : view === "mes" ? monthEnd : date;
  const moves = useQuery({ ...opMovementsQuery(start, end), enabled: view !== "imovel" });

  const tasks = useMemo(() => view === "imovel" ? rows.filter((r) => !taskDone(r))
    : rows.filter((r) => !!r.dueDate && r.dueDate.slice(0, 10) >= start && r.dueDate.slice(0, 10) <= end), [rows, view, start, end]);
  const movements = view === "imovel" ? [] : moves.data ?? [];

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    const add = (k: string, it: Item) => map.set(k, [...(map.get(k) ?? []), it]);
    if (view === "imovel") for (const t of tasks) add(t.propertyName ?? "Sem imóvel", { kind: "task", task: t });
    else {
      for (const m of movements) add(m.date, { kind: "move", move: m });
      for (const t of tasks) add(t.dueDate!.slice(0, 10), { kind: "task", task: t });
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, movements, view]);

  const pendingCount = tasks.filter((t) => !taskDone(t)).length;
  const checkouts = movements.filter((m) => m.type === "checkout");
  const critical = checkouts.filter((m) => m.turnover === "mesmo_dia").length;
  const shift = (n: number) => setDate((d) => view === "mes" ? addDaysISO(d.slice(0, 8) + "01", n > 0 ? 32 : -1).slice(0, 8) + "01" : addDaysISO(d, n));

  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Operação" title="Agenda operacional" description="Serviços, entradas e saídas de hóspedes organizados por dia e imóvel."
      actions={<div className="flex flex-wrap gap-2"><SyncUpcomingButton /><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" />Nova tarefa</Button></div>} />

    {view !== "imovel" && <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <Button variant="ghost" size="icon" aria-label="Período anterior" onClick={() => shift(view === "semana" ? -7 : -1)}><ChevronLeft className="size-4" /></Button>
        <button type="button" className="relative min-w-[13rem] px-2 py-2 text-sm font-medium" onClick={() => picker.current?.showPicker?.()}>
          {view === "mes" ? monthLabel(date) : view === "semana" ? `${longDayLabel(date).split(",")[1]?.trim()} a ${longDayLabel(end).split(",")[1]?.trim()}` : longDayLabel(date)}
          <input ref={picker} type="date" aria-label="Escolher data" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="pointer-events-none absolute inset-0 opacity-0" tabIndex={-1} />
        </button>
        <Button variant="ghost" size="icon" aria-label="Próximo período" onClick={() => shift(view === "semana" ? 7 : 1)}><ChevronRight className="size-4" /></Button>
      </div>
      {date !== today && <Button variant="outline" size="sm" onClick={() => setDate(today)}>Hoje</Button>}
    </div>}

    <div className="portfolio-metrics">
      <PortfolioMetric icon={ListChecks} value={pendingCount} label="Tarefas pendentes" tone={pendingCount ? "warning" : "success"} />
      {view !== "imovel" && <>
        <PortfolioMetric icon={LogOut} value={checkouts.length} label="Saídas (limpeza)" tone="info" />
        <PortfolioMetric icon={LogIn} value={movements.length - checkouts.length} label="Entradas" tone="info" />
        <PortfolioMetric icon={AlertTriangle} value={critical} label="Viradas no mesmo dia" tone={critical ? "warning" : "success"} />
      </>}
    </div>

    <ModuleTabs value={view} onChange={setView} options={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana" }, { value: "mes", label: "Mês" }, { value: "imovel", label: "Pendentes por imóvel" }]} />
    {coreError && <p className="text-xs text-[var(--admin-muted)]">STAYO APP indisponível agora; mostrando tarefas do Admin e reservas já importadas.</p>}

    {loading || (view !== "imovel" && moves.isPending) ? <div className="admin-panel p-5 text-sm text-[var(--admin-muted)]">Carregando agenda…</div>
      : view === "mes" ? <MonthGrid start={monthStart} end={monthEnd} today={today} tasks={tasks} moves={movements} onPick={(d) => { setDate(d); setView("dia"); }} />
      : groups.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={CalendarDays} title="Nada previsto para este período" description={view === "dia" ? "Sem tarefas, entradas ou saídas neste dia." : "Nenhuma tarefa em aberto."} /></div>
      : <div className="space-y-4">{groups.map(([group, items]) => <section key={group} className="admin-panel overflow-hidden">
          <header className="flex items-center justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3">
            <h2 className="font-[var(--stayo-font-display)] text-base">{view === "imovel" ? group : longDayLabel(group)}</h2>
            <small className="text-xs text-[var(--admin-muted)]">{items.length} {items.length === 1 ? "item" : "itens"}</small>
          </header>
          <div className="divide-y divide-[var(--admin-border)]">{sortItems(items).map((it) => it.kind === "move"
            ? <MoveRow key={it.move.id} m={it.move} />
            : <TaskRow key={it.task.id} task={it.task} showDate={view === "imovel"} onEdit={() => { setEditing(it.task); setOpen(true); }} />)}</div>
        </section>)}</div>}

    <p className="text-xs text-[var(--admin-muted)]">Entradas e saídas vêm das reservas já importadas. Tarefas do Admin são editáveis; as do STAYO APP seguem em leitura até o corte.</p>
    <OpTaskDialog open={open} onOpenChange={setOpen} task={editing} defaultDate={date} />
  </div>;
}

const sortKey = (it: Item) => it.kind === "move" ? (it.move.type === "checkout" ? "00" : "99") : (it.task.scheduledTime ?? "98");
const sortItems = (items: Item[]) => [...items].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

function MoveRow({ m }: { m: Movement }) {
  const out = m.type === "checkout";
  const Icon = out ? LogOut : LogIn;
  return <div className={rowCls}>
    <span className={`grid size-9 place-items-center rounded-full ${out ? "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]" : "bg-[var(--admin-info-soft)] text-[var(--admin-primary)]"}`}><Icon className="size-4" aria-hidden /></span>
    <span className="min-w-0"><b className="block truncate text-sm">{out ? "Saída" : "Entrada"} · {m.property}</b><small className="block truncate text-[var(--admin-muted)]">{m.guest ?? "Hóspede não informado"}{m.channel ? ` · ${m.channel.charAt(0).toUpperCase()}${m.channel.slice(1)}` : ""}</small></span>
    <span>{m.turnover === "mesmo_dia" ? <AdminStatusBadge tone="danger">Virada no mesmo dia</AdminStatusBadge>
      : m.turnover === "dia_seguinte" ? <AdminStatusBadge tone="warning">Entrada amanhã</AdminStatusBadge>
      : <AdminStatusBadge tone="neutral">{out ? "Limpar" : "Receber"}</AdminStatusBadge>}</span>
  </div>;
}

function TaskRow({ task, showDate, onEdit }: { task: BoardTask; showDate: boolean; onEdit: () => void }) {
  const body: ReactNode = <>
    <strong className="text-sm tabular-nums text-[var(--admin-primary)]">{showDate ? (task.dueDate ? task.dueDate.slice(8, 10) + "/" + task.dueDate.slice(5, 7) : "—") : (task.scheduledTime?.slice(0, 5) ?? "—")}</strong>
    <span className="min-w-0"><b className="block truncate text-sm">{task.title}</b><small className="block truncate text-[var(--admin-muted)]">{kindLabel(task.kind)} · {task.propertyName ?? "Imóvel não informado"}{task.responsibleName ? ` · ${task.responsibleName}` : ""}</small></span>
    <span className="flex items-center gap-2"><AdminStatusBadge tone={taskDone(task) ? "success" : task.priority === "alta" ? "danger" : task.status === "em_andamento" ? "info" : "neutral"}>{statusText(task)}</AdminStatusBadge><ChevronRight className="hidden size-4 text-[var(--admin-muted)] sm:block" /></span>
  </>;
  return task.source === "admin"
    ? <button type="button" onClick={onEdit} className={`${rowCls} hover:bg-[var(--admin-surface-subtle)]`}>{body}</button>
    : <Link to="/operacao/$id" params={{ id: task.id }} className={`${rowCls} hover:bg-[var(--admin-surface-subtle)]`}>{body}</Link>;
}

const monthLabel = (iso: string) => new Date(`${iso.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).replace(/^./, (c) => c.toUpperCase());
const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function MonthGrid({ start, end, today, tasks, moves, onPick }: { start: string; end: string; today: string; tasks: BoardTask[]; moves: Movement[]; onPick: (d: string) => void }) {
  const lead = (new Date(`${start}T12:00:00Z`).getUTCDay() + 6) % 7;
  const days: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = start; d <= end; d = addDaysISO(d, 1)) days.push(d);
  return <div className="admin-panel overflow-hidden">
    <div className="grid grid-cols-7 border-b border-[var(--admin-border)] text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">{weekDays.map((w) => <span key={w} className="py-2">{w}</span>)}</div>
    <div className="grid grid-cols-7">{days.map((d, i) => {
      if (!d) return <span key={`x${i}`} className="min-h-[5.5rem] border-b border-r border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]" />;
      const dayTasks = tasks.filter((t) => t.dueDate?.slice(0, 10) === d);
      const outs = moves.filter((m) => m.date === d && m.type === "checkout");
      const ins = moves.filter((m) => m.date === d && m.type === "checkin");
      const open = dayTasks.filter((t) => !taskDone(t));
      const unassigned = open.filter((t) => !t.responsibleName).length;
      return <button key={d} type="button" onClick={() => onPick(d)} aria-label={`${longDayLabel(d)}: ${dayTasks.length} rotina(s), ${outs.length} saída(s), ${ins.length} entrada(s)`}
        className={`flex min-h-[5.5rem] flex-col gap-1 border-b border-r border-[var(--admin-border)] p-1.5 text-left align-top hover:bg-[var(--admin-surface-subtle)] ${d === today ? "bg-[var(--admin-info-soft)]" : ""}`}>
        <span className={`text-xs font-semibold tabular-nums ${d === today ? "text-[var(--admin-primary)]" : ""}`}>{Number(d.slice(8))}</span>
        {dayTasks.slice(0, 2).map((t) => <span key={t.id} className={`truncate rounded px-1 text-[10px] leading-4 ${taskDone(t) ? "bg-[var(--admin-success-soft)] text-[var(--admin-success)]" : !t.responsibleName ? "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]" : "bg-[var(--admin-info-soft)] text-[var(--admin-primary)]"}`}>{t.propertyName ?? kindLabel(t.kind)}</span>)}
        {dayTasks.length > 2 && <span className="text-[10px] text-[var(--admin-muted)]">+{dayTasks.length - 2} rotina(s)</span>}
        {(outs.length > 0 || ins.length > 0) && <span className="mt-auto flex gap-1.5 text-[10px] text-[var(--admin-muted)]">{outs.length > 0 && <span className="inline-flex items-center gap-0.5"><LogOut className="size-3" aria-hidden />{outs.length}</span>}{ins.length > 0 && <span className="inline-flex items-center gap-0.5"><LogIn className="size-3" aria-hidden />{ins.length}</span>}</span>}
        {unassigned > 0 && <span className="sr-only">{unassigned} sem profissional</span>}
      </button>;
    })}</div>
    <p className="flex flex-wrap gap-3 border-t border-[var(--admin-border)] px-3 py-2 text-[11px] text-[var(--admin-muted)]"><span>Azul: com profissional</span><span>Amarelo: sem profissional</span><span>Verde: concluída</span><span className="inline-flex items-center gap-1"><LogOut className="size-3" />saídas</span><span className="inline-flex items-center gap-1"><LogIn className="size-3" />entradas</span></p>
  </div>;
}
