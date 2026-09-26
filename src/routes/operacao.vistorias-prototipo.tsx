import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  Link2,
  Loader,
  PlugZap,
  ShieldCheck,
  SlidersHorizontal,
  UserX,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge, type AdminTone } from "@/components/admin/AdminPrimitives";
import { OperacaoPrototypeNav } from "@/components/admin/OperacaoPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/operacao/vistorias-prototipo")({
  head: () => ({
    meta: [
      { title: "Vistorias (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual de vistorias: inspeções, pendências e revisões dos imóveis." },
      { property: "og:title", content: "Vistorias (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura das vistorias operacionais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InspectionsPrototype,
});

/* ---------- Dados demonstrativos em memória, sem dados de hóspedes ---------- */
type Kind = "pre_checkin" | "pos_checkout" | "periodica" | "manutencao" | "inventario" | "implantacao";
type Status = "prevista" | "em_andamento" | "aguardando_revisao" | "concluida" | "vencida";
type Result = "sem_pendencia" | "com_pendencia" | "revisao" | null;
interface Room { name: string; ok: number; pending: number; na: number }
interface Insp {
  id: string;
  property: string;
  kind: Kind;
  when: string;
  today: boolean;
  dayOffset: number;
  owner: string | null;
  status: Status;
  result: Result;
  evidence: number;
  rooms: Room[];
  task: string | null;
  guidance: string;
}

const PROPS = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12", "Imóvel D · 7"];
const OWNERS = ["Operação", "Manutenção", "Implantação"];
const rooms = (p: [number, number, number][]): Room[] =>
  ["Sala", "Cozinha", "Quarto", "Banheiro", "Área externa"].map((name, i) => ({ name, ok: p[i]![0], pending: p[i]![1], na: p[i]![2] }));

const DATA: Insp[] = [
  { id: "v1", property: PROPS[1]!, kind: "pre_checkin", when: "Hoje, 14h30", today: true, dayOffset: 0, owner: null, status: "vencida", result: null, evidence: 0, rooms: rooms([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 2]]), task: "Limpeza de troca (atrasada)", guidance: "Aguardar a conclusão da limpeza e conferir itens de boas-vindas." },
  { id: "v2", property: PROPS[0]!, kind: "pos_checkout", when: "Hoje, 11h", today: true, dayOffset: 0, owner: "Operação", status: "aguardando_revisao", result: "com_pendencia", evidence: 18, rooms: rooms([[8, 0, 0], [10, 1, 0], [7, 0, 0], [6, 2, 0], [0, 0, 3]]), task: "Verificar vazamento na pia", guidance: "Revisar as fotos do banheiro antes de liberar o imóvel." },
  { id: "v3", property: PROPS[2]!, kind: "manutencao", when: "Hoje, 16h", today: true, dayOffset: 0, owner: "Manutenção", status: "em_andamento", result: null, evidence: 3, rooms: rooms([[0, 0, 4], [0, 0, 4], [0, 0, 4], [2, 0, 0], [0, 0, 2]]), task: "Trocar resistência do chuveiro", guidance: "Testar a temperatura da água após a troca." },
  { id: "v4", property: PROPS[3]!, kind: "periodica", when: "Hoje, 17h", today: true, dayOffset: 0, owner: null, status: "prevista", result: null, evidence: 0, rooms: rooms([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]), task: null, guidance: "Usar o roteiro de vistoria periódica." },
  { id: "v5", property: PROPS[1]!, kind: "inventario", when: "Ontem, 10h", today: false, dayOffset: -1, owner: "Operação", status: "aguardando_revisao", result: "revisao", evidence: 42, rooms: rooms([[12, 0, 0], [20, 0, 1], [9, 1, 0], [6, 0, 0], [3, 0, 0]]), task: null, guidance: "Conferir a contagem de louças antes de aprovar o inventário." },
  { id: "v6", property: PROPS[2]!, kind: "pos_checkout", when: "Hoje, 08h30", today: true, dayOffset: 0, owner: "Operação", status: "concluida", result: "sem_pendencia", evidence: 15, rooms: rooms([[8, 0, 0], [11, 0, 0], [7, 0, 0], [8, 0, 0], [0, 0, 3]]), task: null, guidance: "Seguir o roteiro padrão de saída." },
  { id: "v7", property: PROPS[3]!, kind: "implantacao", when: "Em 4 dias, 09h", today: false, dayOffset: 4, owner: "Implantação", status: "prevista", result: null, evidence: 0, rooms: rooms([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]), task: null, guidance: "Registrar o estado inicial de todos os ambientes." },
];

const KIND: Record<Kind, string> = { pre_checkin: "Pré-check-in", pos_checkout: "Pós-check-out", periodica: "Periódica", manutencao: "Manutenção", inventario: "Inventário", implantacao: "Implantação" };
const STATUS: Record<Status, { label: string; tone: AdminTone }> = {
  prevista: { label: "Prevista", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "info" },
  aguardando_revisao: { label: "Aguardando revisão", tone: "warning" },
  concluida: { label: "Concluída", tone: "success" },
  vencida: { label: "Prazo vencido", tone: "danger" },
};
const RESULT: Record<Exclude<Result, null>, { label: string; tone: AdminTone }> = {
  sem_pendencia: { label: "Sem pendência", tone: "success" },
  com_pendencia: { label: "Com pendência", tone: "danger" },
  revisao: { label: "Revisão necessária", tone: "warning" },
};
const ORDER: Record<Status, number> = { vencida: 0, aguardando_revisao: 1, em_andamento: 2, prevista: 3, concluida: 4 };

type Demo = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const demoOptions: { value: Demo; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "parcial", label: "Parcial" },
  { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" },
  { value: "indisponivel", label: "Indisponível" },
];

function InspectionsPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<Demo>("normal");
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState({ prop: "todos", kind: "todos", status: "todos", owner: "todos", period: "todos" });
  const [selected, setSelected] = useState<Insp | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const hasData = demo === "normal" || demo === "parcial";
  // Parcial: fonte de evidências/resultados de revisão indisponível.
  const source = hasData ? DATA : [];
  const list = useMemo(
    () =>
      source
        .filter((i) => f.prop === "todos" || i.property === f.prop)
        .filter((i) => f.kind === "todos" || i.kind === f.kind)
        .filter((i) => f.status === "todos" || i.status === f.status)
        .filter((i) => f.owner === "todos" || (f.owner === "sem" ? !i.owner : i.owner === f.owner))
        .filter((i) => f.period === "todos" || (f.period === "hoje" ? i.today : i.dayOffset <= 7))
        .sort((a, b) => ORDER[a.status] - ORDER[b.status]),
    [source, f],
  );
  const partial = demo === "parcial";
  const affected = new Set(["revisao", "pendencia"]);
  const open = source.filter((i) => i.status !== "concluida");
  const indicators = [
    { key: "hoje", label: "Previstas hoje", icon: CalendarClock, value: open.filter((i) => i.today).length },
    { key: "andamento", label: "Em andamento", icon: Loader, value: open.filter((i) => i.status === "em_andamento").length },
    { key: "revisao", label: "Aguardando revisão", icon: Eye, value: open.filter((i) => i.status === "aguardando_revisao").length },
    { key: "pendencia", label: "Com pendência", icon: AlertTriangle, value: source.filter((i) => i.result === "com_pendencia").length },
    { key: "sem", label: "Sem responsável", icon: UserX, value: open.filter((i) => !i.owner).length },
  ];
  const activeFilters = Object.values(f).filter((v) => v !== "todos").length;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
        <span className="font-medium">Ferramenta de protótipo · estado da tela</span>
        <div className="ml-auto hidden sm:block">
          <PeriodFilter value={demo} onChange={setDemo} options={demoOptions} />
        </div>
        <select aria-label="Estado da tela" value={demo} onChange={(e) => setDemo(e.target.value as Demo)} className="admin-input h-10 w-full px-2 text-sm sm:hidden">
          {demoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <OperacaoPrototypeNav />

      <AdminPageHeader
        title="Vistorias"
        description="Acompanhe inspeções, pendências e revisões dos imóveis."
        meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>}
      />

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState
            icon={PlugZap}
            title="Integração de vistorias indisponível"
            description="Não foi possível obter as vistorias. Indicadores e lista ficam ocultos para não parecer que não há vistorias. Tente novamente em alguns minutos."
          />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            {indicators.map((i) => {
              const hit = partial && affected.has(i.key);
              return (
                <div key={i.key} className="admin-panel flex min-h-16 items-center gap-3 px-3 py-2.5 last:col-span-2 md:last:col-span-1">
                  <i.icon className="h-5 w-5 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--admin-muted)]">{i.label}</p>
                    {demo === "carregando" ? (
                      <span className="admin-skeleton mt-1 inline-block h-5 w-6 rounded" />
                    ) : (
                      <p className="text-xl font-semibold tabular-nums text-[var(--admin-text)]">
                        {i.value}{hit ? "*" : ""}
                        {hit && <span className="ml-1.5 align-middle text-[11px] font-medium text-[var(--admin-muted)]">pode estar incompleto</span>}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((s) => !s)}
            className="admin-input mb-3 inline-flex h-11 items-center gap-2 px-3 text-sm lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </button>
          <div className={`${showFilters ? "grid" : "hidden"} mb-4 grid-cols-2 gap-2 lg:grid lg:grid-cols-5`}>
            <Filter label="Imóvel" value={f.prop} onChange={set("prop")} all="Todos os imóveis" options={PROPS.map((p) => [p, p])} />
            <Filter label="Tipo" value={f.kind} onChange={set("kind")} all="Todos os tipos" options={Object.entries(KIND)} />
            <Filter label="Status" value={f.status} onChange={set("status")} all="Todos os status" options={Object.entries(STATUS).map(([k, v]) => [k, v.label])} />
            <Filter label="Responsável" value={f.owner} onChange={set("owner")} all="Todos responsáveis" options={[["sem", "Sem responsável"], ...OWNERS.map((o) => [o, o] as [string, string])]} />
            <Filter label="Período" value={f.period} onChange={set("period")} all="Todo o período" options={[["hoje", "Hoje"], ["7", "Próximos 7 dias"]]} />
          </div>

          {partial && (
            <p role="status" className="mb-3 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2 text-sm text-[var(--admin-muted)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span><strong className="text-[var(--admin-text)]">Dados parciais:</strong> a atualização de resultados e evidências das vistorias está indisponível. Resultados e fotos podem não aparecer, e os indicadores marcados com * (Aguardando revisão e Com pendência) podem estar incompletos.</span>
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
                  <div className="admin-skeleton h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="admin-panel">
              <AdminEmptyState
                icon={ClipboardCheck}
                title={demo === "vazio" ? "Nenhuma vistoria no período" : "Nenhuma vistoria com esses filtros"}
                description={demo === "vazio" ? "Quando houver vistorias previstas, elas aparecem aqui." : "Ajuste os filtros para ver outras vistorias."}
              />
            </div>
          ) : (
            <div className="admin-panel overflow-hidden">
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_auto] gap-4 border-b border-[var(--admin-border)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--admin-muted)] lg:grid">
                <span>Vistoria</span><span>Data</span><span>Responsável</span><span>Status e resultado</span><span className="w-4" />
              </div>
              <ul className="divide-y divide-[var(--admin-border)]">
                {list.map((i) => (
                  <li key={i.id}><Row i={i} partial={partial} onOpen={setSelected} /></li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[88vh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-md"}>
          {selected && <Detail i={selected} partial={partial} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Filter({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; all: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="admin-input h-11 w-full min-w-0 px-2 text-sm">
      <option value="todos">{all}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Row({ i, partial, onOpen }: { i: Insp; partial: boolean; onOpen: (i: Insp) => void }) {
  const overdue = i.status === "vencida";
  const pending = i.result === "com_pendencia" && !partial;
  const result = partial ? null : i.result;
  return (
    <button
      type="button"
      onClick={() => onOpen(i)}
      className={`grid w-full gap-x-4 gap-y-2 border-l-4 px-4 py-3 text-left lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_auto] lg:items-center ${overdue || pending ? "border-l-[var(--admin-danger,currentColor)]" : "border-l-transparent"}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--admin-text)]">{i.property}</span>
        <span className="block text-xs text-[var(--admin-muted)]">
          {KIND[i.kind]} · <Camera className="inline h-3 w-3" aria-hidden="true" /> {partial ? "evidências indisponíveis" : `${i.evidence} ${i.evidence === 1 ? "evidência" : "evidências"}`}
        </span>
      </span>
      <span className={`flex items-center gap-1 text-sm ${overdue ? "font-semibold text-[var(--admin-danger,currentColor)]" : "text-[var(--admin-text)]"}`}>
        {overdue ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Clock className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />}
        {i.when}
      </span>
      <span className={`flex items-center gap-1 text-sm ${!i.owner ? "font-semibold text-[var(--admin-warning,currentColor)]" : "text-[var(--admin-text)]"}`}>
        {!i.owner && <UserX className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {i.owner ?? "Sem responsável"}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <AdminStatusBadge tone={STATUS[i.status].tone}>
          {overdue && <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" />}
          {STATUS[i.status].label}
        </AdminStatusBadge>
        {result && (
          <AdminStatusBadge tone={RESULT[result].tone}>
            {result === "com_pendencia" && <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" />}
            {RESULT[result].label}
          </AdminStatusBadge>
        )}
        <ChevronRight className="ml-auto h-4 w-4 text-[var(--admin-muted)] lg:hidden" aria-hidden="true" />
      </span>
      <ChevronRight className="hidden h-4 w-4 text-[var(--admin-muted)] lg:block" aria-hidden="true" />
    </button>
  );
}

function Detail({ i, partial }: { i: Insp; partial: boolean }) {
  const totals = i.rooms.reduce((a, r) => ({ ok: a.ok + r.ok, pending: a.pending + r.pending, na: a.na + r.na }), { ok: 0, pending: 0, na: 0 });
  const rows: [string, string][] = [
    ["Tipo", KIND[i.kind]],
    ["Imóvel", i.property],
    ["Data e responsável", `${i.when} · ${i.owner ?? "Sem responsável"}`],
    ["Status", STATUS[i.status].label],
    ["Resultado", partial ? "Indisponível no momento" : i.result ? RESULT[i.result].label : "Ainda sem resultado"],
  ];
  return (
    <>
      <SheetHeader>
        <SheetTitle>Vistoria {KIND[i.kind].toLowerCase()}</SheetTitle>
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
          <dt className="text-xs text-[var(--admin-muted)]">Resumo por ambiente</dt>
          <dd className="mt-1 text-sm text-[var(--admin-text)]">
            <p className="mb-2">{totals.ok} verificados · {totals.pending} pendentes · {totals.na} não aplicáveis</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--admin-muted)]">
                  <th className="py-1 font-normal">Ambiente</th>
                  <th className="py-1 text-right font-normal">Verificados</th>
                  <th className="py-1 text-right font-normal">Pendentes</th>
                  <th className="py-1 text-right font-normal">N/A</th>
                </tr>
              </thead>
              <tbody>
                {i.rooms.map((r) => (
                  <tr key={r.name} className="border-t border-[var(--admin-border)]">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="py-2 text-right tabular-nums">{r.ok}</td>
                    <td className={`py-2 text-right tabular-nums ${r.pending ? "font-semibold" : ""}`}>
                      {r.pending > 0 && <AlertTriangle className="mr-1 inline h-3 w-3" aria-label="Com pendência" />}
                      {r.pending}
                    </td>
                    <td className="py-2 text-right tabular-nums">{r.na}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 py-3">
          <dt className="text-xs text-[var(--admin-muted)]">Fotos e evidências</dt>
          <dd className="flex items-center gap-1.5 text-sm text-[var(--admin-text)]">
            <Camera className="h-4 w-4" aria-hidden="true" />
            {partial ? "Indisponível no momento" : i.evidence === 0 ? "Nenhuma evidência registrada" : `${i.evidence} registradas`}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 py-3">
          <dt className="text-xs text-[var(--admin-muted)]">Tarefa relacionada</dt>
          <dd className="flex items-center gap-1.5 text-sm text-[var(--admin-text)]">
            <Link2 className="h-4 w-4" aria-hidden="true" />{i.task ?? "Nenhuma tarefa relacionada"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 py-3">
          <dt className="text-xs text-[var(--admin-muted)]">Orientação de campo</dt>
          <dd className="text-sm text-[var(--admin-text)]">{i.guidance}</dd>
          <dd className="mt-1 flex items-start gap-1.5 rounded-md border border-[var(--admin-border)] p-2 text-xs text-[var(--admin-muted)]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            No produto real, este conteúdo será filtrado por permissão e nunca exibirá dados de hóspedes, mensagens, telefones, documentos, senhas, códigos de acesso ou notas administrativas sensíveis.
          </dd>
        </div>
      </dl>
    </>
  );
}
