import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  Camera,
  ChevronRight,
  Clock,
  Link2,
  PlugZap,
  Repeat,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserX,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { OperacaoPrototypeNav } from "@/components/admin/OperacaoPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/operacao/tarefas-prototipo")({
  head: () => ({
    meta: [
      { title: "Tarefas operacionais (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual das tarefas operacionais: prazos, responsáveis e prioridades." },
      { property: "og:title", content: "Tarefas operacionais (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura das tarefas operacionais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPrototype,
});

/* ---------- Dados demonstrativos em memória, sem dados de hóspedes ---------- */
type Kind = "limpeza" | "manutencao" | "vistoria" | "preparacao" | "outro";
type Status = "pendente" | "em_andamento" | "atrasada" | "concluida";
type Priority = "critica" | "alta" | "normal";
interface Task {
  id: string;
  title: string;
  property: string;
  kind: Kind;
  due: string;
  dueToday: boolean;
  dayOffset: number;
  status: Status;
  priority: Priority;
  owner: string | null;
  event: string | null;
  turnover: boolean;
  checklist: [number, number];
  evidence: number;
  guidance: string;
}

const PROPS = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12", "Imóvel D · 7"];
const OWNERS = ["Equipe limpeza", "Manutenção", "Operação"];

const TASKS: Task[] = [
  { id: "t1", title: "Limpeza de troca", property: PROPS[1]!, kind: "limpeza", due: "SLA vencido há 40 min", dueToday: true, dayOffset: 0, status: "atrasada", priority: "critica", owner: null, event: "Check-in hoje às 15h", turnover: true, checklist: [0, 14], evidence: 0, guidance: "Priorizar banheiro e cozinha; seguir o checklist padrão de troca." },
  { id: "t2", title: "Vistoria pós-limpeza", property: PROPS[1]!, kind: "vistoria", due: "Hoje até 14h30", dueToday: true, dayOffset: 0, status: "pendente", priority: "critica", owner: "Operação", event: "Check-in hoje às 15h", turnover: true, checklist: [0, 8], evidence: 0, guidance: "Conferir itens de boas-vindas e registrar fotos dos ambientes." },
  { id: "t3", title: "Trocar resistência do chuveiro", property: PROPS[2]!, kind: "manutencao", due: "Hoje até 18h", dueToday: true, dayOffset: 0, status: "em_andamento", priority: "alta", owner: "Manutenção", event: null, turnover: false, checklist: [1, 3], evidence: 1, guidance: "Desligar o disjuntor antes da troca e testar a temperatura ao final." },
  { id: "t4", title: "Limpeza de saída", property: PROPS[0]!, kind: "limpeza", due: "Hoje até 16h", dueToday: true, dayOffset: 0, status: "em_andamento", priority: "normal", owner: "Equipe limpeza", event: "Check-out hoje às 10h30", turnover: false, checklist: [9, 14], evidence: 3, guidance: "Seguir o checklist padrão de saída." },
  { id: "t5", title: "Repor kit de boas-vindas", property: PROPS[3]!, kind: "preparacao", due: "Hoje até 17h30", dueToday: true, dayOffset: 0, status: "pendente", priority: "normal", owner: null, event: null, turnover: false, checklist: [0, 4], evidence: 0, guidance: "Conferir café, chás e itens de banheiro conforme o padrão do imóvel." },
  { id: "t6", title: "Verificar vazamento na pia", property: PROPS[0]!, kind: "manutencao", due: "Venceu ontem", dueToday: false, dayOffset: -1, status: "atrasada", priority: "alta", owner: null, event: null, turnover: false, checklist: [0, 2], evidence: 0, guidance: "Registrar foto antes e depois; acionar fornecedor se necessário." },
  { id: "t7", title: "Vistoria periódica", property: PROPS[1]!, kind: "vistoria", due: "Em 3 dias", dueToday: false, dayOffset: 3, status: "pendente", priority: "normal", owner: "Operação", event: null, turnover: false, checklist: [0, 12], evidence: 0, guidance: "Usar o roteiro de vistoria periódica." },
  { id: "t8", title: "Revisão do ar-condicionado", property: PROPS[3]!, kind: "outro", due: "Em 6 dias", dueToday: false, dayOffset: 6, status: "pendente", priority: "normal", owner: "Manutenção", event: null, turnover: false, checklist: [0, 3], evidence: 0, guidance: "Limpar filtros e testar os modos de operação." },
  { id: "t9", title: "Limpeza de saída", property: PROPS[2]!, kind: "limpeza", due: "Concluída às 09h10", dueToday: true, dayOffset: 0, status: "concluida", priority: "normal", owner: "Equipe limpeza", event: "Check-out hoje às 08h", turnover: false, checklist: [14, 14], evidence: 6, guidance: "Seguir o checklist padrão de saída." },
];

const KIND: Record<Kind, string> = { limpeza: "Limpeza", manutencao: "Manutenção", vistoria: "Vistoria", preparacao: "Preparação", outro: "Outro" };
const STATUS: Record<Status, { label: string; tone: AdminTone }> = {
  pendente: { label: "Pendente", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "info" },
  atrasada: { label: "Atrasada", tone: "danger" },
  concluida: { label: "Concluída", tone: "success" },
};
const PRIORITY: Record<Priority, { label: string; tone: AdminTone }> = {
  critica: { label: "Crítica", tone: "danger" },
  alta: { label: "Alta", tone: "warning" },
  normal: { label: "Normal", tone: "neutral" },
};
const PRIO_RANK: Record<Priority, number> = { critica: 0, alta: 1, normal: 2 };

type Demo = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const demoOptions: { value: Demo; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "parcial", label: "Parcial" },
  { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" },
  { value: "indisponivel", label: "Indisponível" },
];
type Tab = "todas" | "pendente" | "em_andamento" | "atrasada" | "concluida" | "sem";
const TABS: { value: Tab; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendente", label: "Pendentes" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "atrasada", label: "Atrasadas" },
  { value: "concluida", label: "Concluídas" },
  { value: "sem", label: "Sem responsável" },
];
type Quick = "critica" | "atrasada" | "sem" | "hoje" | null;

function TasksPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<Demo>("normal");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("todas");
  const [quick, setQuick] = useState<Quick>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState({ prop: "todos", kind: "todos", status: "todos", prio: "todos", owner: "todos", period: "todos" });
  const [selected, setSelected] = useState<Task | null>(null);

  const hasData = demo === "normal" || demo === "parcial";
  const source = hasData ? TASKS.filter((t) => !(demo === "parcial" && t.kind === "manutencao")) : [];

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return source
      .filter((t) => !term || t.title.toLowerCase().includes(term) || t.property.toLowerCase().includes(term))
      .filter((t) => (tab === "todas" ? true : tab === "sem" ? !t.owner && t.status !== "concluida" : t.status === tab))
      .filter((t) =>
        quick === "critica" ? t.priority === "critica" && t.status !== "concluida"
        : quick === "atrasada" ? t.status === "atrasada"
        : quick === "sem" ? !t.owner && t.status !== "concluida"
        : quick === "hoje" ? t.dueToday && t.status !== "concluida"
        : true,
      )
      .filter((t) => f.prop === "todos" || t.property === f.prop)
      .filter((t) => f.kind === "todos" || t.kind === f.kind)
      .filter((t) => f.status === "todos" || t.status === f.status)
      .filter((t) => f.prio === "todos" || t.priority === f.prio)
      .filter((t) => f.owner === "todos" || (f.owner === "sem" ? !t.owner : t.owner === f.owner))
      .filter((t) => f.period === "todos" || (f.period === "hoje" ? t.dayOffset <= 0 : t.dayOffset <= 7))
      .sort((a, b) =>
        Number(a.status === "concluida") - Number(b.status === "concluida") ||
        Number(b.status === "atrasada") - Number(a.status === "atrasada") ||
        PRIO_RANK[a.priority] - PRIO_RANK[b.priority],
      );
  }, [source, q, tab, quick, f]);

  const open = source.filter((t) => t.status !== "concluida");
  const indicators: { key: Exclude<Quick, null>; label: string; icon: typeof AlertTriangle; value: number; tone: AdminTone }[] = [
    { key: "critica", label: "Críticas", icon: AlertTriangle, value: open.filter((t) => t.priority === "critica").length, tone: "danger" },
    { key: "atrasada", label: "Atrasadas", icon: Clock, value: open.filter((t) => t.status === "atrasada").length, tone: "danger" },
    { key: "sem", label: "Sem responsável", icon: UserX, value: open.filter((t) => !t.owner).length, tone: "warning" },
    { key: "hoje", label: "Vencem hoje", icon: CalendarClock, value: open.filter((t) => t.dueToday).length, tone: "info" },
  ];
  const activeFilters = Object.values(f).filter((v) => v !== "todos").length;
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
        <span className="font-medium">Ferramenta de protótipo · estado da tela</span>
        <div className="ml-auto hidden sm:block">
          <PeriodFilter value={demo} onChange={setDemo} options={demoOptions} />
        </div>
        <select
          aria-label="Estado da tela"
          value={demo}
          onChange={(e) => setDemo(e.target.value as Demo)}
          className="admin-input h-10 w-full px-2 text-sm sm:hidden"
        >
          {demoOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <OperacaoPrototypeNav />

      <AdminPageHeader
        title="Tarefas operacionais"
        description="Acompanhe pendências, responsáveis e prazos da operação."
        meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>}
      />

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState
            icon={PlugZap}
            title="Integração operacional indisponível"
            description="Não foi possível obter as tarefas. Contadores e lista ficam ocultos para não parecerem dados reais. Tente novamente em alguns minutos."
          />
        </div>
      ) : (
        <>
          {/* Indicadores que filtram */}
          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {indicators.map((i) => {
              const active = quick === i.key;
              return (
                <button
                  key={i.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setQuick(active ? null : i.key)}
                  className={`admin-panel flex min-h-16 items-center gap-3 px-3 py-2.5 text-left transition-shadow ${active ? "ring-2 ring-[var(--admin-primary)]" : "hover:shadow-sm"}`}
                >
                  <i.icon className="h-5 w-5 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-[var(--admin-muted)]">{i.label}</span>
                    {demo === "carregando" ? (
                      <span className="admin-skeleton mt-1 inline-block h-5 w-6 rounded" />
                    ) : (
                      <span className="block text-xl font-semibold tabular-nums text-[var(--admin-text)]">
                        {demo === "parcial" && i.key !== "hoje" ? `${i.value}*` : i.value}
                        {demo === "parcial" && i.key !== "hoje" && (
                          <span className="ml-1.5 align-middle text-[11px] font-medium text-[var(--admin-muted)]">pode estar incompleto</span>
                        )}
                      </span>
                    )}
                  </span>
                  {active && <span className="text-[10px] font-semibold uppercase text-[var(--admin-primary)]">Filtro</span>}
                </button>
              );
            })}
          </div>

          {/* Busca + filtros */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="admin-search-field min-w-0 flex-1 sm:max-w-sm">
              <Search aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tarefa ou imóvel" />
            </label>
            <button
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((s) => !s)}
              className="admin-input inline-flex h-10 items-center gap-2 px-3 text-sm lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
            </button>
          </div>
          <div className={`${showFilters ? "grid" : "hidden"} mb-3 grid-cols-2 gap-2 lg:grid lg:grid-cols-6`}>
            <Filter label="Imóvel" value={f.prop} onChange={set("prop")} all="Todos os imóveis" options={PROPS.map((p) => [p, p])} />
            <Filter label="Tipo" value={f.kind} onChange={set("kind")} all="Todos os tipos" options={Object.entries(KIND)} />
            <Filter label="Status" value={f.status} onChange={set("status")} all="Todos os status" options={Object.entries(STATUS).map(([k, v]) => [k, v.label])} />
            <Filter label="Prioridade" value={f.prio} onChange={set("prio")} all="Todas prioridades" options={Object.entries(PRIORITY).map(([k, v]) => [k, v.label])} />
            <Filter label="Responsável" value={f.owner} onChange={set("owner")} all="Todos responsáveis" options={[["sem", "Sem responsável"], ...OWNERS.map((o) => [o, o] as [string, string])]} />
            <Filter label="Período" value={f.period} onChange={set("period")} all="Todo o período" options={[["hoje", "Até hoje"], ["7", "Próximos 7 dias"]]} />
          </div>

          {/* Abas de status */}
          <label className="mb-3 flex items-center gap-2 lg:hidden">
            <span className="shrink-0 text-sm font-medium text-[var(--admin-text)]">Status:</span>
            <select
              aria-label="Status"
              value={tab}
              onChange={(e) => setTab(e.target.value as Tab)}
              className="admin-input h-11 min-w-0 flex-1 px-3 text-sm"
            >
              {TABS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <div role="tablist" aria-label="Status" className="mb-3 hidden gap-1 border-b lg:flex border-[var(--admin-border)]">
            {TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={`min-h-10 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm ${tab === t.value ? "border-[var(--admin-primary)] font-medium text-[var(--admin-text)]" : "border-transparent text-[var(--admin-muted)]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {demo === "parcial" && (
            <p role="status" className="mb-3 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2 text-sm text-[var(--admin-muted)]">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span><strong className="text-[var(--admin-text)]">Dados parciais:</strong> a atualização de tarefas de manutenção está indisponível. Tarefas de manutenção não aparecem na lista, e os indicadores marcados com * (Críticas, Atrasadas e Sem responsável) podem estar incompletos.</span>
            </p>
          )}

          {demo === "carregando" ? (
            <div className="admin-panel" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-4 last:border-0">
                  <div className="flex-1 space-y-2">
                    <div className="admin-skeleton h-3.5 w-1/2 rounded" />
                    <div className="admin-skeleton h-3 w-1/3 rounded" />
                  </div>
                  <div className="admin-skeleton h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="admin-panel">
              <AdminEmptyState
                title={demo === "vazio" ? "Nenhuma tarefa operacional" : "Nenhuma tarefa com esses filtros"}
                description={demo === "vazio" ? "Quando houver pendências da operação, elas aparecem aqui." : "Limpe a busca ou ajuste os filtros para ver outras tarefas."}
              />
            </div>
          ) : (
            <div className="admin-panel overflow-hidden">
              <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-4 border-b border-[var(--admin-border)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--admin-muted)] lg:grid">
                <span>Tarefa</span><span>Prazo</span><span>Responsável</span><span>Status</span><span className="w-4" />
              </div>
              <ul className="divide-y divide-[var(--admin-border)]">
                {list.map((t) => (
                  <li key={t.id}>
                    <TaskRow t={t} onOpen={setSelected} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "max-h-[88vh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-md"}
        >
          {selected && <TaskDetail t={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Filter({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; all: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="admin-input h-10 w-full min-w-0 px-2 text-sm">
      <option value="todos">{all}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function Flags({ t }: { t: Task }) {
  if (t.status === "concluida") return null;
  return (
    <span className="flex flex-wrap gap-1">
      {t.priority === "critica" && <AdminStatusBadge tone="danger"><AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" />Crítica</AdminStatusBadge>}
      {t.turnover && <AdminStatusBadge tone="danger"><Repeat className="mr-1 inline h-3 w-3" aria-hidden="true" />Troca no mesmo dia</AdminStatusBadge>}
      {t.priority === "alta" && <AdminStatusBadge tone="warning">Alta</AdminStatusBadge>}
    </span>
  );
}

function TaskRow({ t, onOpen }: { t: Task; onOpen: (t: Task) => void }) {
  const overdue = t.status === "atrasada";
  const urgent = t.priority === "critica" && t.status !== "concluida";
  const noOwner = !t.owner && t.status !== "concluida";
  return (
    <button
      type="button"
      onClick={() => onOpen(t)}
      className={`grid w-full gap-x-4 gap-y-2 px-4 py-3 text-left lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center ${urgent || overdue ? "border-l-4 border-l-[var(--admin-danger,currentColor)]" : "border-l-4 border-l-transparent"} ${t.status === "concluida" ? "bg-[var(--admin-bg,transparent)]" : ""}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--admin-text)]">{t.title}</span>
        <span className="block text-xs text-[var(--admin-muted)]">{t.property} · {KIND[t.kind]}</span>
        {t.event && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--admin-muted)]">
            <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />{t.event}
          </span>
        )}
        <span className="mt-1 block"><Flags t={t} /></span>
      </span>
      <span className={`flex items-center gap-1 text-sm ${overdue ? "font-semibold text-[var(--admin-danger,currentColor)]" : "text-[var(--admin-text)]"}`}>
        {overdue ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Clock className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />}
        {t.due}
      </span>
      <span className={`flex items-center gap-1 text-sm ${noOwner ? "font-semibold text-[var(--admin-warning,currentColor)]" : "text-[var(--admin-text)]"}`}>
        {noOwner && <UserX className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {t.owner ?? "Sem responsável"}
      </span>
      <span className="flex items-center justify-between gap-2">
        <AdminStatusBadge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</AdminStatusBadge>
        <ChevronRight className="h-4 w-4 text-[var(--admin-muted)] lg:hidden" aria-hidden="true" />
      </span>
      <ChevronRight className="hidden h-4 w-4 text-[var(--admin-muted)] lg:block" aria-hidden="true" />
    </button>
  );
}

function TaskDetail({ t }: { t: Task }) {
  const [done, total] = t.checklist;
  const pct = Math.round((done / total) * 100);
  const rows: [string, string][] = [
    ["Imóvel", t.property],
    ["Tipo", KIND[t.kind]],
    ["Status", STATUS[t.status].label],
    ["Prioridade", PRIORITY[t.priority].label],
    ["Prazo", t.due],
    ["Responsável", t.owner ?? "Sem responsável"],
    ["Evento vinculado", t.event ?? "Nenhum evento vinculado"],
  ];
  return (
    <>
      <SheetHeader>
        <SheetTitle>{t.title}</SheetTitle>
        <SheetDescription>Dados demonstrativos · somente leitura</SheetDescription>
      </SheetHeader>
      <dl className="mt-4 divide-y divide-[var(--admin-border)]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 py-3">
            <dt className="text-xs text-[var(--admin-muted)]">{k}</dt>
            <dd className="text-sm text-[var(--admin-text)]">{v}</dd>
          </div>
        ))}
        <div className="py-3">
          <dt className="text-xs text-[var(--admin-muted)]">Checklist</dt>
          <dd className="mt-1 text-sm text-[var(--admin-text)]">
            {done} de {total} itens ({pct}%)
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--admin-border)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-[var(--admin-primary)]" style={{ width: `${pct}%` }} />
            </div>
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 py-3">
          <dt className="text-xs text-[var(--admin-muted)]">Evidências</dt>
          <dd className="flex items-center gap-1.5 text-sm text-[var(--admin-text)]">
            <Camera className="h-4 w-4" aria-hidden="true" />
            {t.evidence === 0 ? "Nenhuma evidência registrada" : `${t.evidence} ${t.evidence === 1 ? "foto registrada" : "fotos registradas"}`}
          </dd>
        </div>
        <div className="flex flex-col gap-1 py-3">
          <dt className="text-xs text-[var(--admin-muted)]">Orientação operacional</dt>
          <dd className="text-sm text-[var(--admin-text)]">{t.guidance}</dd>
          <dd className="mt-1 flex items-start gap-1.5 rounded-md border border-[var(--admin-border)] p-2 text-xs text-[var(--admin-muted)]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            No produto real, este campo não exibirá mensagens de hóspedes, telefones, documentos, senhas, códigos de acesso nem observações administrativas sensíveis.
          </dd>
        </div>
      </dl>
    </>
  );
}
