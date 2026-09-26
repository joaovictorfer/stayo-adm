import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronDown,
  ClipboardCheck,
  LogIn,
  LogOut,
  PlugZap,
  Repeat,
  Sparkles,
  Wrench,
  ListChecks,
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

export const Route = createFileRoute("/operacao/agenda-prototipo")({
  head: () => ({
    meta: [
      { title: "Agenda operacional (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual da agenda operacional por dia, semana e imóvel." },
      { property: "og:title", content: "Agenda operacional (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura da agenda operacional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPrototype,
});

/* ---------- Dados demonstrativos, somente em memória, sem hóspedes ---------- */
type Kind = "checkin" | "checkout" | "limpeza" | "vistoria" | "manutencao" | "tarefa";
type Status = "pendente" | "em_andamento" | "concluido" | "atrasado";
type Priority = "critica" | "alta" | "normal";
interface Ev {
  id: string;
  day: number; // deslocamento a partir da data selecionada
  time: string;
  kind: Kind;
  property: string;
  status: Status;
  priority: Priority;
  owner: string | null;
  note: string;
}

const PROPS = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12", "Imóvel D · 7"];
const OWNERS = ["Equipe limpeza", "Manutenção", "Operação"];

const EVENTS: Ev[] = [
  { id: "e1", day: 0, time: "10:00", kind: "checkout", property: PROPS[1]!, status: "concluido", priority: "normal", owner: null, note: "Saída registrada pela fechadura." },
  { id: "e2", day: 0, time: "11:00", kind: "limpeza", property: PROPS[1]!, status: "atrasado", priority: "critica", owner: null, note: "Limpeza de troca ainda não iniciada." },
  { id: "e3", day: 0, time: "15:00", kind: "checkin", property: PROPS[1]!, status: "pendente", priority: "critica", owner: null, note: "Entrada depende da limpeza anterior." },
  { id: "e4", day: 0, time: "10:30", kind: "checkout", property: PROPS[0]!, status: "concluido", priority: "normal", owner: null, note: "Saída sem ocorrências." },
  { id: "e5", day: 0, time: "12:00", kind: "limpeza", property: PROPS[0]!, status: "em_andamento", priority: "normal", owner: "Equipe limpeza", note: "Limpeza de saída em andamento." },
  { id: "e6", day: 0, time: "14:00", kind: "vistoria", property: PROPS[0]!, status: "pendente", priority: "normal", owner: "Operação", note: "Vistoria após a limpeza." },
  { id: "e7", day: 0, time: "16:00", kind: "manutencao", property: PROPS[2]!, status: "pendente", priority: "alta", owner: "Manutenção", note: "Chuveiro com baixa pressão." },
  { id: "e8", day: 0, time: "17:30", kind: "tarefa", property: PROPS[3]!, status: "pendente", priority: "normal", owner: null, note: "Repor kit de boas-vindas." },
  { id: "e9", day: 1, time: "11:00", kind: "checkout", property: PROPS[2]!, status: "pendente", priority: "normal", owner: null, note: "Saída prevista." },
  { id: "e10", day: 1, time: "12:00", kind: "limpeza", property: PROPS[2]!, status: "pendente", priority: "alta", owner: "Equipe limpeza", note: "Limpeza de saída." },
  { id: "e11", day: 2, time: "15:00", kind: "checkin", property: PROPS[3]!, status: "pendente", priority: "normal", owner: null, note: "Entrada prevista." },
  { id: "e12", day: 3, time: "09:00", kind: "vistoria", property: PROPS[1]!, status: "pendente", priority: "normal", owner: "Operação", note: "Vistoria periódica." },
  { id: "e13", day: 4, time: "10:00", kind: "checkout", property: PROPS[0]!, status: "pendente", priority: "normal", owner: null, note: "Saída prevista." },
  { id: "e14", day: 4, time: "11:00", kind: "limpeza", property: PROPS[0]!, status: "pendente", priority: "critica", owner: null, note: "Troca no mesmo dia." },
  { id: "e15", day: 4, time: "16:00", kind: "checkin", property: PROPS[0]!, status: "pendente", priority: "critica", owner: null, note: "Entrada no mesmo dia." },
  { id: "e16", day: 6, time: "14:00", kind: "manutencao", property: PROPS[3]!, status: "pendente", priority: "normal", owner: "Manutenção", note: "Revisão do ar-condicionado." },
];

const KIND: Record<Kind, { label: string; icon: typeof LogIn }> = {
  checkin: { label: "Check-in", icon: LogIn },
  checkout: { label: "Check-out", icon: LogOut },
  limpeza: { label: "Limpeza", icon: Sparkles },
  vistoria: { label: "Vistoria", icon: ClipboardCheck },
  manutencao: { label: "Manutenção", icon: Wrench },
  tarefa: { label: "Tarefa", icon: ListChecks },
};
const STATUS: Record<Status, { label: string; tone: AdminTone }> = {
  pendente: { label: "Pendente", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "info" },
  concluido: { label: "Concluído", tone: "success" },
  atrasado: { label: "Atrasado", tone: "danger" },
};
const PRIORITY: Record<Priority, string> = { critica: "Crítica", alta: "Alta", normal: "Normal" };

type Demo = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const demoOptions: { value: Demo; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "parcial", label: "Parcial" },
  { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" },
  { value: "indisponivel", label: "Indisponível" },
];
type View = "dia" | "semana" | "imovel";
const viewOptions: { value: View; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "imovel", label: "Por imóvel" },
];

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d;
};
const fmtDay = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).format(d);

/** Troca crítica = check-out + limpeza + check-in no mesmo imóvel e dia. */
function turnoverKeys(list: Ev[]) {
  const s = new Set<string>();
  const groups = new Map<string, Set<Kind>>();
  for (const e of list) {
    const k = `${e.day}|${e.property}`;
    groups.set(k, (groups.get(k) ?? new Set()).add(e.kind));
  }
  for (const [k, kinds] of groups)
    if (kinds.has("checkout") && kinds.has("limpeza") && kinds.has("checkin")) s.add(k);
  return s;
}

function AgendaPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<Demo>("normal");
  const [view, setView] = useState<View>("dia");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fProp, setFProp] = useState("todos");
  const [fKind, setFKind] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fOwner, setFOwner] = useState("todos");
  const [selected, setSelected] = useState<Ev | null>(null);

  const filtered = useMemo(
    () =>
      EVENTS.filter(
        (e) =>
          (fProp === "todos" || e.property === fProp) &&
          (fKind === "todos" || e.kind === fKind) &&
          (fStatus === "todos" || e.status === fStatus) &&
          (fOwner === "todos" || (fOwner === "sem" ? !e.owner : e.owner === fOwner)) &&
          !(demo === "parcial" && e.kind === "vistoria"),
      ),
    [fProp, fKind, fStatus, fOwner, demo],
  );
  const turnovers = useMemo(() => turnoverKeys(EVENTS), []);
  const hasData = demo === "normal" || demo === "parcial";
  const list = hasData ? filtered : [];

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
        <span className="font-medium">Ferramenta de protótipo · estado da tela</span>
        <div className="ml-auto hidden sm:block">
          <PeriodFilter value={demo} onChange={setDemo} options={demoOptions} />
        </div>
        <select aria-label="Estado do protótipo" value={demo} onChange={(e) => setDemo(e.target.value as DemoState)} className="admin-input h-9 w-full px-2 text-xs sm:hidden">
          {demoOptions.map((o) => <option key={o.value} value={o.value}>Estado: {o.label}</option>)}
        </select>
      </div>

      <OperacaoPrototypeNav />

      <AdminPageHeader
        title="Agenda operacional"
        description="Acompanhe os eventos e pendências por período e imóvel."
        meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>}
        actions={
          <>
            <input
              type="date"
              aria-label="Data"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="admin-input h-10 px-3 text-sm"
            />
            <PeriodFilter value={view} onChange={setView} options={viewOptions} />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Filter label="Imóvel" value={fProp} onChange={setFProp} options={PROPS.map((p) => [p, p])} all="Todos os imóveis" />
        <Filter label="Tipo de evento" value={fKind} onChange={setFKind} options={Object.entries(KIND).map(([k, v]) => [k, v.label])} all="Todos os tipos" />
        <Filter label="Status" value={fStatus} onChange={setFStatus} options={Object.entries(STATUS).map(([k, v]) => [k, v.label])} all="Todos os status" />
        <Filter label="Responsável" value={fOwner} onChange={setFOwner} options={[["sem", "Sem responsável"], ...OWNERS.map((o) => [o, o] as [string, string])]} all="Todos os responsáveis" />
      </div>

      {demo === "parcial" && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Dados parciais: vistorias não foram carregadas. A agenda abaixo pode estar incompleta.
        </p>
      )}

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState
            icon={PlugZap}
            title="Integração operacional indisponível"
            description="Não foi possível obter a agenda. Nenhum evento é exibido para não parecer uma agenda vazia. Tente novamente em alguns minutos."
          />
        </div>
      ) : demo === "carregando" ? (
        <div className="admin-panel" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-4 last:border-0">
              <div className="admin-skeleton h-4 w-12 rounded" />
              <div className="admin-skeleton h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="admin-skeleton h-3.5 w-1/2 rounded" />
                <div className="admin-skeleton h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : view === "dia" ? (
        <DayView list={list.filter((e) => e.day === 0)} turnovers={turnovers} onOpen={setSelected} />
      ) : view === "semana" ? (
        <WeekView list={list} date={date} turnovers={turnovers} onOpen={setSelected} />
      ) : (
        <PropertyView list={list} date={date} onOpen={setSelected} />
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "max-h-[85vh] overflow-y-auto rounded-t-2xl" : "w-full sm:max-w-md"}
        >
          {selected && <EventDetail ev={selected} date={date} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
  all,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  all: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="admin-input h-10 w-full min-w-0 px-2 text-sm"
    >
      <option value="todos">{all}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function Empty() {
  return (
    <div className="admin-panel">
      <AdminEmptyState title="Nenhum evento no período" description="Ajuste a data ou os filtros para ver outros eventos." />
    </div>
  );
}

function EventRow({ ev, onOpen, showProperty = true, showTime = true }: { ev: Ev; onOpen: (e: Ev) => void; showProperty?: boolean; showTime?: boolean }) {
  const K = KIND[ev.kind];
  return (
    <button
      type="button"
      onClick={() => onOpen(ev)}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--admin-surface-muted,transparent)] focus-visible:outline-2"
    >
      {showTime && <span className="w-11 shrink-0 text-sm tabular-nums text-[var(--admin-muted)]">{ev.time}</span>}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)]">
        <K.icon className="h-4 w-4 text-[var(--admin-muted)]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--admin-text)]">
          {K.label}
          {ev.priority === "critica" && <span className="ml-1.5 text-xs font-semibold text-[var(--admin-danger,currentColor)]">· Crítica</span>}
        </span>
        <span className="block truncate text-xs text-[var(--admin-muted)]">
          {showProperty ? `${ev.property} · ` : ""}
          {ev.owner ?? "Sem responsável"}
        </span>
      </span>
      <AdminStatusBadge tone={STATUS[ev.status].tone}>{STATUS[ev.status].label}</AdminStatusBadge>
    </button>
  );
}

function TurnoverTag() {
  return (
    <AdminStatusBadge tone="danger">
      <Repeat className="mr-1 inline h-3 w-3" aria-hidden="true" />
      Troca no mesmo dia
    </AdminStatusBadge>
  );
}

function DayView({ list, turnovers, onOpen }: { list: Ev[]; turnovers: Set<string>; onOpen: (e: Ev) => void }) {
  if (list.length === 0) return <Empty />;
  const groups = new Map<string, Ev[]>();
  for (const e of list) groups.set(e.property, [...(groups.get(e.property) ?? []), e]);
  const ordered = [...groups.entries()]
    .map(([p, evs]) => [p, evs.sort((a, b) => a.time.localeCompare(b.time))] as const)
    .sort(([pa, a], [pb, b]) => {
      const ta = turnovers.has(`0|${pa}`) ? 0 : 1;
      const tb = turnovers.has(`0|${pb}`) ? 0 : 1;
      return ta - tb || a[0]!.time.localeCompare(b[0]!.time);
    });
  return (
    <div className="flex flex-col gap-3">
      {ordered.map(([prop, evs]) => {
        const turnover = turnovers.has(`0|${prop}`);
        return (
          <section
            key={prop}
            className={`admin-panel overflow-hidden ${turnover ? "border-l-4 border-l-[var(--admin-danger,currentColor)]" : ""}`}
          >
            <header className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">{prop}</h2>
              {turnover && <TurnoverTag />}
            </header>
            <ol className="divide-y divide-[var(--admin-border)]">
              {evs.map((e) => (
                <li key={e.id}>
                  <EventRow ev={e} onOpen={onOpen} showProperty={false} />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function WeekView({ list, date, turnovers, onOpen }: { list: Ev[]; date: string; turnovers: Set<string>; onOpen: (e: Ev) => void }) {
  if (list.length === 0) return <Empty />;
  const rank = (e: Ev) => (e.priority === "critica" ? 0 : e.kind === "limpeza" && e.status !== "concluido" ? 1 : e.kind === "checkin" || e.kind === "checkout" ? 2 : 3);
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 7 }).map((_, d) => {
        const evs = list.filter((e) => e.day === d).sort((a, b) => rank(a) - rank(b) || a.time.localeCompare(b.time));
        const dayTurnovers = [...new Set(evs.map((e) => e.property))].filter((p) => turnovers.has(`${d}|${p}`));
        return (
          <section key={d} className="admin-panel overflow-hidden">
            <header className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
              <h2 className="text-sm font-semibold capitalize text-[var(--admin-text)]">{fmtDay(addDays(date, d))}</h2>
              <span className="text-xs text-[var(--admin-muted)]">{evs.length} {evs.length === 1 ? "evento" : "eventos"}</span>
              {dayTurnovers.length > 0 && <TurnoverTag />}
            </header>
            {evs.length === 0 ? (
              <p className="px-4 py-3 text-xs text-[var(--admin-muted)]">Sem eventos.</p>
            ) : (
              <ol className="divide-y divide-[var(--admin-border)]">
                {evs.map((e) => (
                  <li key={e.id}>
                    <EventRow ev={e} onOpen={onOpen} />
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PropertyView({ list, date, onOpen }: { list: Ev[]; date: string; onOpen: (e: Ev) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (list.length === 0) return <Empty />;
  const groups = new Map<string, Ev[]>();
  for (const e of list) groups.set(e.property, [...(groups.get(e.property) ?? []), e]);
  return (
    <div className="flex flex-col gap-3">
      {[...groups.entries()].map(([prop, evs]) => {
        evs.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
        const pending = evs.filter((e) => e.status === "pendente" || e.status === "atrasado").length;
        const noOwner = evs.filter((e) => !e.owner && e.status !== "concluido").length;
        const isOpen = open === prop;
        return (
          <section key={prop} className="admin-panel overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : prop)}
              className="flex min-h-14 w-full flex-wrap items-center gap-2 px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold text-[var(--admin-text)]">{prop}</span>
              <span className="text-xs text-[var(--admin-muted)]">
                {pending} pendentes{noOwner > 0 ? ` · ${noOwner} sem responsável` : ""}
              </span>
              <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {isOpen && (
              <ol className="divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)]">
                {evs.map((e, i) => {
                  const newDay = i === 0 || evs[i - 1]!.day !== e.day;
                  return (
                    <li key={e.id}>
                      {newDay && (
                        <p className="bg-[var(--admin-bg,transparent)] px-4 pt-2 text-xs font-semibold capitalize text-[var(--admin-muted)]">
                          {fmtDay(addDays(date, e.day))}
                        </p>
                      )}
                      <EventRow ev={e} onOpen={onOpen} showProperty={false} />
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

function EventDetail({ ev, date }: { ev: Ev; date: string }) {
  const K = KIND[ev.kind];
  const rows: [string, React.ReactNode][] = [
    ["Imóvel", ev.property],
    ["Data e hora", `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(addDays(date, ev.day))} · ${ev.time}`],
    ["Status", STATUS[ev.status].label],
    ["Prioridade", PRIORITY[ev.priority]],
    ["Responsável", ev.owner ?? "Sem responsável"],
    ["Observação operacional", ev.note],
  ];
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <K.icon className="h-5 w-5" aria-hidden="true" /> {K.label}
        </SheetTitle>
        <SheetDescription>Dados demonstrativos · somente leitura</SheetDescription>
      </SheetHeader>
      <dl className="mt-4 divide-y divide-[var(--admin-border)]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 py-3">
            <dt className="text-xs text-[var(--admin-muted)]">{k}</dt>
            <dd className="text-sm text-[var(--admin-text)]">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
