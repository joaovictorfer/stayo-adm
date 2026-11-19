import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Brush, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ListChecks, LogIn, LogOut, Plus, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { CleanPropertyDialog } from "@/components/admin/CleanPropertyDialog";
import { OpTaskDialog } from "@/components/admin/OpTaskDialog";
import { SyncUpcomingButton } from "@/components/admin/SyncUpcomingButton";
import { kindLabel, taskDone, useBoardTasks } from "@/components/admin/TaskBoard";
import { Button } from "@/components/ui/button";
import { cleaningBoardQuery, type CleaningRow } from "@/lib/api/op-cleaning-api";
import { opStaffQuery } from "@/lib/api/op-execution";
import type { BoardTask } from "@/lib/api/op-tasks";
import { opMovementsQuery } from "@/lib/api/op-movements-api";
import { addDaysISO, localISODate, longDayLabel } from "@/lib/local-date";
import type { CleaningState } from "@/lib/op-cleaning";

export const Route = createFileRoute("/operacao/")({
  head: () => ({ meta: [
    { title: "Painel operacional — Stayo Admin" },
    { name: "description", content: "Imóveis, reservas, limpeza, equipe e pendências em uma visão operacional STAYO." },
    { property: "og:title", content: "Painel operacional — Stayo Admin" },
    { property: "og:description", content: "Acompanhe reservas, situação dos imóveis, rotinas e profissionais da operação STAYO." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: OperationPage,
});

const shortDay = (iso: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const dm = (iso: string | null) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—";
const stateInfo: Record<CleaningState, { label: string; tone: "success" | "danger" | "info" | "neutral" }> = {
  pronto: { label: "Pronto", tone: "success" }, sujo: { label: "Sujo", tone: "danger" }, ocupado: { label: "Ocupado", tone: "info" }, sem_registro: { label: "Sem registro", tone: "neutral" },
};
type PropertyFilter = "todos" | "sujo" | "pronto" | "ocupado" | "sem_profissional";

function OperationPage() {
  const today = localISODate();
  const qc = useQueryClient();
  const { rows, pending, adminError, coreError } = useBoardTasks();
  const board = useQuery(cleaningBoardQuery(today));
  const staff = useQuery(opStaffQuery());
  const [date, setDate] = useState(today);
  const weekEnd = addDaysISO(date, 6);
  const moves = useQuery(opMovementsQuery(date, weekEnd));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [cleaning, setCleaning] = useState<CleaningRow | null>(null);
  const [filter, setFilter] = useState<PropertyFilter>("todos");
  const [term, setTerm] = useState("");
  const [taskFilter, setTaskFilter] = useState<"dia" | "atrasadas" | "sem_profissional">("dia");
  const d = (t: BoardTask) => t.dueDate?.slice(0, 10) ?? "";
  const openTasks = rows.filter((t) => !taskDone(t));
  const late = openTasks.filter((t) => d(t) && d(t) < today);
  const properties = board.data?.rows ?? [];
  const routines = board.data?.open ?? [];
  const noTeam = routines.filter((r) => !r.staffId);
  const dayMoves = (moves.data ?? []).filter((m) => m.date === date);
  const query = term.trim().toLocaleLowerCase("pt-BR");
  const matches = (label: string) => !query || label.toLocaleLowerCase("pt-BR").includes(query);
  const shown = properties.filter((p) => matches(`${p.property} ${p.code}`) && (filter === "todos" || (filter === "sem_profissional" ? routines.some((r) => r.implementationId === p.id && !r.staffId) : p.status.state === filter)));
  const tasks = (taskFilter === "atrasadas" ? late : taskFilter === "sem_profissional" ? openTasks.filter((t) => noTeam.some((r) => r.id === t.id)) : rows.filter((t) => d(t) === date))
    .filter((t) => matches(`${t.title} ${t.propertyName ?? ""} ${t.responsibleName ?? ""}`));
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const day = addDaysISO(date, i);
    const ms = (moves.data ?? []).filter((m) => m.date === day);
    return { day, outs: ms.filter((m) => m.type === "checkout").length, ins: ms.filter((m) => m.type === "checkin").length,
      tasks: rows.filter((t) => !taskDone(t) && t.dueDate?.slice(0, 10) === day).length };
  }), [date, moves.data, rows]);
  const edit = (t: BoardTask) => { setEditing(t); setOpen(true); };
  const refresh = () => { for (const key of ["op-cleaning", "op-tasks", "op-costs"]) void qc.invalidateQueries({ queryKey: [key] }); };
  const activeStaff = (staff.data ?? []).filter((s) => s.active);

  return <div className="space-y-6">
    <AdminPageHeader eyebrow="Operação · STAYO" title="Painel operacional" description={longDayLabel(today)} actions={<div className="flex flex-wrap gap-2"><SyncUpcomingButton /><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" />Nova tarefa</Button></div>} />
    <nav aria-label="Atalhos da operação" className="flex flex-wrap gap-2 border-b border-border pb-4">
      {([{ to: "/operacao/agenda", label: "Agenda", icon: CalendarDays }, { to: "/operacao/limpeza", label: "Limpeza dos imóveis", icon: Brush }, { to: "/operacao/equipe", label: "Equipe e Meu Dia", icon: Users }, { to: "/operacao/tarefas", label: "Todas as tarefas", icon: ListChecks }] as const).map((l) => <Button key={l.to} asChild variant="outline" size="sm"><Link to={l.to}><l.icon className="size-4" />{l.label}</Link></Button>)}
    </nav>
    <div className="portfolio-metrics">
      <PortfolioMetric icon={Sparkles} value={board.isPending ? "—" : properties.filter((p) => p.status.state === "pronto").length} label="Imóveis prontos" tone="success" />
      <PortfolioMetric icon={Brush} value={board.isPending ? "—" : properties.filter((p) => p.status.state === "sujo").length} label="Imóveis sujos" tone="warning" />
      <PortfolioMetric icon={LogOut} value={moves.isPending ? "—" : dayMoves.filter((m) => m.type === "checkout").length} label={`Saídas · ${dm(date)}`} tone="info" />
      <PortfolioMetric icon={LogIn} value={moves.isPending ? "—" : dayMoves.filter((m) => m.type === "checkin").length} label={`Entradas · ${dm(date)}`} tone="info" />
      <PortfolioMetric icon={Users} value={board.isPending ? "—" : noTeam.length} label="Limpezas sem profissional" tone={noTeam.length ? "warning" : "success"} />
      <PortfolioMetric icon={Clock3} value={pending ? "—" : late.length} label="Tarefas atrasadas" tone={late.length ? "warning" : "success"} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" />Reservas do Guia · mês atual + 2 meses · atualização programada a cada 15 min</span>
      <span>{properties.length} imóveis em operação · {routines.length} limpezas em aberto</span>
    </div>
    {(adminError || coreError || moves.isError || board.isError) && <div role="alert" className="flex gap-2 border-l-2 border-destructive bg-muted p-3 text-sm"><AlertTriangle className="size-4 shrink-0" /><span>{adminError ? "Não foi possível carregar as tarefas do Admin. " : ""}{board.isError ? "Situação de limpeza indisponível. " : ""}{moves.isError ? "Reservas do período indisponíveis. " : ""}{coreError ? "Tarefas do Guia indisponíveis; registros já importados continuam disponíveis." : ""}<Button variant="link" size="sm" onClick={() => { refresh(); void moves.refetch(); }}>Tentar novamente</Button></span></div>}

    <section className="space-y-4" aria-label="Situação dos imóveis">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-[var(--stayo-font-display)] text-xl font-semibold">Todos os imóveis</h2><p className="mt-1 text-sm text-muted-foreground">{shown.length} de {properties.length} imóveis</p></div><div className="w-full sm:w-72"><CompactSearch value={term} onChange={setTerm} placeholder="Buscar imóvel, tarefa ou profissional" /></div></div>
      <ModuleTabs value={filter} onChange={setFilter} options={[{ value: "todos", label: "Todos" }, { value: "sujo", label: "Sujos" }, { value: "pronto", label: "Prontos" }, { value: "ocupado", label: "Ocupados" }, { value: "sem_profissional", label: "Sem profissional" }]} />
      {board.isPending ? <p className="py-8 text-sm text-muted-foreground">Carregando imóveis…</p> : board.isError ? <p className="py-6 text-sm text-destructive">Não foi possível carregar os imóveis.</p> : shown.length === 0 ? <AdminEmptyState icon={Brush} title="Nenhum imóvel neste filtro" description="" /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map((p) => {
        const status = stateInfo[p.status.state];
        const next = p.next;
        return <article key={p.id} className="rounded-md border border-border bg-background p-4 transition-colors hover:border-primary/40">
          <header className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-[var(--stayo-font-display)] text-base font-semibold">{p.property}</h3><span className="text-xs text-muted-foreground">{p.code}</span></div><AdminStatusBadge tone={status.tone}>{status.label}</AdminStatusBadge></header>
          <dl className="my-4 grid grid-cols-2 gap-3 border-y border-border py-3 text-xs"><div><dt className="text-muted-foreground">Próxima entrada</dt><dd className="mt-1 font-semibold">{dm(p.status.nextCheckin)}</dd></div><div><dt className="text-muted-foreground">Última limpeza</dt><dd className="mt-1 font-semibold">{dm(p.status.lastCleaning)}</dd></div></dl>
          <div className="flex min-h-12 items-start gap-2 text-sm"><Brush className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="font-medium">{next ? `Limpeza em ${dm(next.dueDate)}` : "Nenhuma limpeza em aberto"}</p><p className={next && !next.staffId ? "text-[var(--admin-danger)] text-xs" : "text-xs text-muted-foreground"}>{next ? next.staffName ?? "Sem profissional vinculado" : "—"}</p></div></div>
          <footer className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setCleaning(p)}><CheckCircle2 className="size-4" />Marcar limpo</Button>{next && <Button size="sm" variant="ghost" onClick={() => { const task = rows.find((t) => t.id === next.id); if (task) edit(task); }} disabled={!rows.some((t) => t.id === next.id)}><Users className="size-4" />Abrir rotina</Button>}</footer>
        </article>;
      })}</div>}
    </section>

    <section className="space-y-4 border-t border-border pt-6" aria-label="Reservas e rotinas">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-[var(--stayo-font-display)] text-xl font-semibold">Reservas e rotinas</h2><div className="flex flex-wrap items-center gap-1"><Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => setDate(addDaysISO(date, -7))}><ChevronLeft className="size-4" /></Button><input aria-label="Data do painel" type="date" value={date} onChange={(e) => { if (e.target.value) setDate(e.target.value); }} className="h-9 rounded-md border border-input bg-background px-2 text-sm" /><Button variant="ghost" size="icon" aria-label="Próxima semana" onClick={() => setDate(addDaysISO(date, 7))}><ChevronRight className="size-4" /></Button>{date !== today && <Button variant="outline" size="sm" onClick={() => setDate(today)}>Hoje</Button>}</div></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{week.map((w) => <Button key={w.day} variant={date === w.day ? "secondary" : "outline"} className="h-auto min-h-20 flex-col items-start gap-1 p-3" onClick={() => setDate(w.day)}><strong className="capitalize">{w.day === today ? "Hoje" : shortDay(w.day)}</strong><span className="text-xs font-normal text-muted-foreground">{w.ins} entradas · {w.outs} saídas</span><span className="text-xs">{w.tasks} tarefas</span></Button>)}</div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-primary" />Movimentações · {dm(date)}</h3>{moves.isPending ? <p className="py-4 text-sm text-muted-foreground">Carregando reservas…</p> : <ul className="divide-y divide-border border-y border-border">{dayMoves.filter((m) => matches(m.property)).map((m) => <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">{m.type === "checkout" ? <LogOut className="size-4 text-[var(--admin-warning)]" /> : <LogIn className="size-4 text-primary" />}<div className="min-w-0 flex-1"><b className="block break-words text-sm">{m.property}</b><span className="text-xs text-muted-foreground">{m.type === "checkout" ? "Saída" : "Entrada"} · {m.guest ?? "Hóspede"}</span></div>{m.turnover && <AdminStatusBadge tone={m.turnover === "mesmo_dia" ? "danger" : "warning"}>{m.turnover === "mesmo_dia" ? "Virada no dia" : "Entrada amanhã"}</AdminStatusBadge>}</li>)}{!dayMoves.filter((m) => matches(m.property)).length && <li className="py-6 text-sm text-muted-foreground">Nenhuma movimentação neste dia.</li>}</ul>}</div>
        <div className="space-y-3"><ModuleTabs value={taskFilter} onChange={setTaskFilter} options={[{ value: "dia", label: "Tarefas do dia" }, { value: "atrasadas", label: "Atrasadas", count: late.length }, { value: "sem_profissional", label: "Sem profissional", count: noTeam.length }]} />{pending ? <p className="py-4 text-sm text-muted-foreground">Carregando tarefas…</p> : <ul className="divide-y divide-border border-y border-border">{tasks.map((t) => <li key={`${t.source}-${t.id}`}><TaskLine t={t} onEdit={edit} /></li>)}{tasks.length === 0 && <li className="py-6 text-sm text-muted-foreground">Nenhuma tarefa neste filtro.</li>}</ul>}</div>
      </div>
    </section>
    <section className="border-t border-border pt-6" aria-label="Distribuição da equipe"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-[var(--stayo-font-display)] text-xl font-semibold">Equipe e distribuição</h2><Button asChild variant="ghost" size="sm"><Link to="/operacao/equipe">Gerenciar equipe<ArrowRight className="size-4" /></Link></Button></div>{staff.isError ? <p className="text-sm text-destructive">Não foi possível carregar a equipe.</p> : staff.isPending ? <p className="text-sm text-muted-foreground">Carregando equipe…</p> : activeStaff.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum profissional ativo cadastrado.</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{activeStaff.map((s) => { const mine = routines.filter((r) => r.staffId === s.id); return <div key={s.id} className="flex items-center gap-3 rounded-md border border-border p-4"><Users className="size-5 shrink-0 text-primary" /><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{s.name}</h3><p className="text-xs text-muted-foreground">{mine.length} limpezas em aberto</p></div></div>; })}</div>}</section>
    <OpTaskDialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) refresh(); }} task={editing} defaultDate={date} />
    <CleanPropertyDialog row={cleaning} staff={activeStaff} today={today} onClose={() => setCleaning(null)} onDone={refresh} />
  </div>;
}

function TaskLine({ t, onEdit }: { t: BoardTask; onEdit: (t: BoardTask) => void }) {
  const inner = <><span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">{dm(t.dueDate)}</span><span className="min-w-0 flex-1"><b className="block break-words text-sm">{t.title}</b><small className="block text-muted-foreground">{t.propertyName ?? "Sem imóvel"} · {kindLabel(t.kind)}{t.responsibleName ? ` · ${t.responsibleName}` : ""}</small></span><AdminStatusBadge tone={taskDone(t) ? "success" : t.status === "em_andamento" ? "info" : "neutral"}>{/cancel/i.test(t.status) ? "Cancelada" : taskDone(t) ? "Concluída" : t.status === "em_andamento" ? "Em andamento" : "Pendente"}</AdminStatusBadge><ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" /></>;
  const cls = "flex h-auto min-h-16 w-full justify-start gap-2 px-0 py-3 text-left whitespace-normal";
  return t.source === "admin" ? <Button variant="ghost" className={cls} onClick={() => onEdit(t)}>{inner}</Button> : <Button variant="ghost" className={cls} asChild><Link to="/operacao/$id" params={{ id: t.id }}>{inner}</Link></Button>;
}
