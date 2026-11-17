import { localISODate } from "@/lib/local-date";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, ListChecks, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { OpTaskDialog } from "@/components/admin/OpTaskDialog";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { Button } from "@/components/ui/button";
import { type BoardTask, opKindLabel, opTasksQuery } from "@/lib/api/op-tasks";
import { operationTasksListQuery } from "@/lib/api/queries";

type Status = "abertas" | "atrasadas" | "concluidas" | "todas";
const today = localISODate();
export const taskDone = (t: { status: string }) => /conclu|feito|done|cancel/i.test(t.status);
const late = (t: BoardTask) => !taskDone(t) && !!t.dueDate && t.dueDate < today;
const isMaintenance = (t: BoardTask) => /manut|reparo|conserto/i.test(`${t.kind} ${t.title}`);
export const kindLabel = (k: string) => (opKindLabel as Record<string, string>)[k] ?? (k ? k.charAt(0).toUpperCase() + k.slice(1) : "Outro");
const dateLabel = (iso: string | null) => iso ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${iso.slice(0, 10)}T12:00:00`)) : "Sem data";

/** Une tarefas gravadas no Admin (editáveis) às do STAYO APP (somente leitura), sem importar histórico. */
export function useBoardTasks() {
  const core = useQuery(operationTasksListQuery());
  const admin = useQuery(opTasksQuery());
  const rows = useMemo<BoardTask[]>(() => [
    ...(admin.data ?? []),
    ...(core.data?.data ?? []).map((t) => ({ ...t, source: "core" as const })),
  ], [admin.data, core.data]);
  return { rows, pending: admin.isPending && core.isPending, adminError: admin.isError, coreError: core.isError };
}

export function TaskBoard({ mode }: { mode: "tarefas" | "manutencao" }) {
  const { rows: all, pending, adminError, coreError } = useBoardTasks();
  const [status, setStatus] = useState<Status>("abertas");
  const [kind, setKind] = useState("todos");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [open, setOpen] = useState(false);
  const base = useMemo(() => all.filter((t) => mode === "tarefas" || isMaintenance(t)), [all, mode]);
  const kinds = useMemo(() => [...new Set(base.map((t) => t.kind).filter(Boolean))], [base]);
  const rows = base.filter((t) => {
    const term = q.trim().toLowerCase();
    const okStatus = status === "todas" || (status === "abertas" && !taskDone(t)) || (status === "atrasadas" && late(t)) || (status === "concluidas" && taskDone(t));
    return okStatus && (kind === "todos" || t.kind === kind) && (!term || [t.title, t.propertyName, t.reservationCode].some((v) => v?.toLowerCase().includes(term)));
  }).sort((a, b) => `${a.dueDate ?? "9"}${a.scheduledTime ?? ""}`.localeCompare(`${b.dueDate ?? "9"}${b.scheduledTime ?? ""}`));
  const openTask = (t: BoardTask | null) => { setEditing(t); setOpen(true); };

  const body = (t: BoardTask) => <>
    <span className="reservation-date"><span><strong>{dateLabel(t.dueDate).split(" ")[0]}</strong>{dateLabel(t.dueDate).split(" ").slice(1).join(" ")}</span></span>
    <span className="min-w-0"><b className="block truncate text-sm">{t.title}</b>
      <small className="flex items-center gap-1 truncate text-[var(--admin-muted)]">{t.scheduledTime && <><Clock3 className="h-3 w-3" />{t.scheduledTime} · </>}{t.propertyName ?? "Sem imóvel"} · {kindLabel(t.kind)}{t.responsibleName ? ` · ${t.responsibleName}` : ""}</small></span>
    <span className="flex flex-wrap gap-2">
      <AdminStatusBadge tone="neutral">{t.source === "admin" ? "Admin" : "STAYO APP"}</AdminStatusBadge>
      <AdminStatusBadge tone={taskDone(t) ? "success" : late(t) ? "warning" : "info"}>{taskDone(t) ? (/cancel/i.test(t.status) ? "Cancelada" : "Concluída") : late(t) ? "Atrasada" : t.status === "em_andamento" ? "Em andamento" : "Em aberto"}</AdminStatusBadge>
    </span>
  </>;

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow="Operação" title={mode === "tarefas" ? "Tarefas" : "Manutenção"}
        description={mode === "tarefas" ? "Rotinas de limpeza, vistoria e apoio por imóvel. Tarefas do Admin são editáveis; as do STAYO APP seguem em leitura." : "Chamados e reparos dos imóveis."}
        actions={<Button onClick={() => openTask(null)}><Plus className="size-4" />Nova tarefa</Button>} />
      <div className="portfolio-metrics">
        <PortfolioMetric icon={ListChecks} value={pending ? "—" : base.filter((t) => !taskDone(t)).length} label="Em aberto" tone="info" />
        <PortfolioMetric icon={AlertTriangle} value={pending ? "—" : base.filter(late).length} label="Atrasadas" tone="warning" />
        <PortfolioMetric icon={CheckCircle2} value={pending ? "—" : base.filter(taskDone).length} label="Concluídas" tone="success" />
      </div>
      <ModuleTabs value={status} onChange={setStatus} options={[{ value: "abertas", label: "Em aberto" }, { value: "atrasadas", label: "Atrasadas" }, { value: "concluidas", label: "Concluídas" }, { value: "todas", label: "Todas" }]} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        {mode === "tarefas" && kinds.length > 0 ? <ModuleTabs value={kind} onChange={setKind} options={[{ value: "todos", label: "Todos os tipos" }, ...kinds.map((k) => ({ value: k, label: kindLabel(k) }))]} /> : <span />}
        <CompactSearch value={q} onChange={setQ} placeholder="Buscar tarefa, imóvel ou reserva" />
      </div>
      {(coreError || adminError) && <p className="text-xs text-[var(--admin-muted)]">{coreError ? "STAYO APP indisponível agora; mostrando apenas tarefas do Admin." : "Tarefas do Admin indisponíveis agora."}</p>}
      {pending ? <div className="admin-panel p-6 text-sm text-[var(--admin-muted)]">Atualizando tarefas…</div>
        : rows.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={ListChecks} title="Nada neste recorte" description="Altere os filtros ou crie uma nova tarefa." /></div>
        : <div className="space-y-2">{rows.map((t) => t.source === "admin"
            ? <button key={t.id} type="button" onClick={() => openTask(t)} className="reservation-card w-full text-left">{body(t)}</button>
            : <Link key={t.id} to="/operacao/$id" params={{ id: t.id }} className="reservation-card">{body(t)}</Link>)}</div>}
      <OpTaskDialog open={open} onOpenChange={setOpen} task={editing} defaultDate={today} />
    </div>
  );
}
