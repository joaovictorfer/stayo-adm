import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { operationTasksListQuery } from "@/lib/api/queries";
import type { OperationTask } from "@/types/core";

type Status = "abertas" | "atrasadas" | "concluidas" | "todas";
const today = new Date().toISOString().slice(0, 10);
const done = (t: OperationTask) => /conclu|feito|done/i.test(t.status);
const late = (t: OperationTask) => !done(t) && !!t.dueDate && t.dueDate < today;
const isMaintenance = (t: OperationTask) => /manut|reparo|conserto/i.test(`${t.kind} ${t.title}`);
const kindLabel = (k: string) => k ? k.charAt(0).toUpperCase() + k.slice(1) : "Outro";
const dateLabel = (iso: string | null) => iso ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${iso.slice(0, 10)}T12:00:00`)) : "Sem data";

/** Quadro de leitura das tarefas do Core. Atribuir, reagendar e concluir ficam no STAYO APP até existir comando idempotente. */
export function TaskBoard({ mode }: { mode: "tarefas" | "manutencao" }) {
  const query = useQuery(operationTasksListQuery());
  const [status, setStatus] = useState<Status>("abertas");
  const [kind, setKind] = useState("todos");
  const [q, setQ] = useState("");
  const base = useMemo(() => (query.data?.data ?? []).filter((t) => mode === "tarefas" || isMaintenance(t)), [query.data, mode]);
  const kinds = useMemo(() => [...new Set(base.map((t) => t.kind).filter(Boolean))], [base]);
  const rows = base.filter((t) => {
    const term = q.trim().toLowerCase();
    const okStatus = status === "todas" || (status === "abertas" && !done(t)) || (status === "atrasadas" && late(t)) || (status === "concluidas" && done(t));
    return okStatus && (kind === "todos" || t.kind === kind) && (!term || [t.title, t.propertyName, t.reservationCode].some((v) => v?.toLowerCase().includes(term)));
  }).sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
  const ok = query.isSuccess;

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow="Operação" title={mode === "tarefas" ? "Tarefas" : "Manutenção"}
        description={mode === "tarefas" ? "Rotinas de limpeza, vistoria e apoio por imóvel. Somente leitura nesta fase." : "Chamados e reparos dos imóveis. Somente leitura nesta fase."} />
      <div className="portfolio-metrics">
        <PortfolioMetric icon={ListChecks} value={ok ? base.filter((t) => !done(t)).length : "—"} label="Em aberto" tone="info" />
        <PortfolioMetric icon={AlertTriangle} value={ok ? base.filter(late).length : "—"} label="Atrasadas" tone="warning" />
        <PortfolioMetric icon={CheckCircle2} value={ok ? base.filter(done).length : "—"} label="Concluídas" tone="success" />
      </div>
      <ModuleTabs value={status} onChange={setStatus} options={[{ value: "abertas", label: "Em aberto" }, { value: "atrasadas", label: "Atrasadas" }, { value: "concluidas", label: "Concluídas" }, { value: "todas", label: "Todas" }]} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        {mode === "tarefas" && kinds.length > 0 ? <ModuleTabs value={kind} onChange={setKind} options={[{ value: "todos", label: "Todos os tipos" }, ...kinds.map((k) => ({ value: k, label: kindLabel(k) }))]} /> : <span />}
        <CompactSearch value={q} onChange={setQ} placeholder="Buscar tarefa, imóvel ou reserva" />
      </div>
      {query.isPending ? <div className="admin-panel p-6 text-sm text-[var(--admin-muted)]">Atualizando tarefas…</div>
        : query.isError ? <div className="admin-panel"><AdminEmptyState title="Tarefas indisponíveis" description="A integração com o STAYO APP não respondeu." /></div>
        : rows.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={ListChecks} title="Nada neste recorte" description="Altere os filtros ou aguarde a integração com o Core." /></div>
        : <div className="space-y-2">{rows.map((t) => (
            <Link key={t.id} to="/operacao/$id" params={{ id: t.id }} className="reservation-card">
              <span className="reservation-date"><span><strong>{dateLabel(t.dueDate).split(" ")[0]}</strong>{dateLabel(t.dueDate).split(" ").slice(1).join(" ")}</span></span>
              <span className="min-w-0"><b className="block truncate text-sm">{t.title}</b>
                <small className="flex items-center gap-1 truncate text-[var(--admin-muted)]">{t.scheduledTime && <><Clock3 className="h-3 w-3" />{t.scheduledTime} · </>}{t.propertyName ?? "Sem imóvel"} · {kindLabel(t.kind)}</small></span>
              <span className="flex flex-wrap gap-2"><AdminStatusBadge tone={done(t) ? "success" : late(t) ? "warning" : "info"}>{done(t) ? "Concluída" : late(t) ? "Atrasada" : "Em aberto"}</AdminStatusBadge></span>
            </Link>
          ))}</div>}
    </div>
  );
}
