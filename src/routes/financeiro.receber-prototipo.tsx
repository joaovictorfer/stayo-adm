import { MonthPicker } from "@/components/ui/month-picker";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Hourglass, PlugZap, Search, SearchCheck, SlidersHorizontal, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge, type AdminTone } from "@/components/admin/AdminPrimitives";
import { FinanceiroPrototypeNav } from "@/components/admin/FinanceiroPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/financeiro/receber-prototipo")({
  head: () => ({
    meta: [
      { title: "Contas a receber (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual de Contas a receber do Stayo Admin, com dados demonstrativos." },
      { property: "og:title", content: "Contas a receber (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura, dados demonstrativos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceberPrototype,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PROPERTIES = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12"];

type Origin = "reserva" | "servico" | "ajuste";
type Status = "previsto" | "parcial" | "recebido" | "vencido" | "revisao" | "cancelado";
const ORIGIN: Record<Origin, string> = { reserva: "Reserva", servico: "Serviço", ajuste: "Ajuste" };
const STATUS: Record<Status, { label: string; tone: AdminTone }> = {
  previsto: { label: "Previsto", tone: "info" },
  parcial: { label: "Parcial", tone: "warning" },
  recebido: { label: "Recebido", tone: "success" },
  vencido: { label: "Vencido", tone: "danger" },
  revisao: { label: "Em revisão", tone: "warning" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};
const STATUS_OPTS: { value: "todos" | Status; label: string }[] = [
  { value: "todos", label: "Todos" }, { value: "previsto", label: "Previstos" }, { value: "parcial", label: "Parciais" },
  { value: "recebido", label: "Recebidos" }, { value: "vencido", label: "Vencidos" }, { value: "revisao", label: "Em revisão" },
  { value: "cancelado", label: "Cancelados" },
];

interface Entry { code: string; property: string; origin: Origin; competence: string; due: string; dueDays: number; expected: number; received: number; status: Status; reason?: string; updated: string }
const ENTRIES: Entry[] = [
  { code: "CR-1042", property: PROPERTIES[1]!, origin: "reserva", competence: "09/2026", due: "23/09/2026", dueDays: -3, expected: 1840, received: 0, status: "vencido", updated: "26/09 09:10" },
  { code: "CR-1047", property: PROPERTIES[0]!, origin: "reserva", competence: "09/2026", due: "20/09/2026", dueDays: -6, expected: 2400, received: 1200, status: "parcial", updated: "25/09 17:40" },
  { code: "CR-1051", property: PROPERTIES[2]!, origin: "ajuste", competence: "09/2026", due: "28/09/2026", dueDays: 2, expected: 380, received: 0, status: "revisao", reason: "Valor do ajuste diverge do fechamento demonstrativo.", updated: "26/09 08:30" },
  { code: "CR-1053", property: PROPERTIES[0]!, origin: "servico", competence: "09/2026", due: "29/09/2026", dueDays: 3, expected: 450, received: 0, status: "previsto", updated: "26/09 07:55" },
  { code: "CR-1055", property: PROPERTIES[1]!, origin: "reserva", competence: "10/2026", due: "02/10/2026", dueDays: 6, expected: 3150, received: 0, status: "previsto", updated: "26/09 07:55" },
  { code: "CR-1058", property: PROPERTIES[2]!, origin: "reserva", competence: "10/2026", due: "12/10/2026", dueDays: 16, expected: 2780, received: 0, status: "previsto", updated: "26/09 07:55" },
  { code: "CR-1031", property: PROPERTIES[0]!, origin: "reserva", competence: "09/2026", due: "15/09/2026", dueDays: -11, expected: 2960, received: 2960, status: "recebido", updated: "15/09 14:02" },
  { code: "CR-1036", property: PROPERTIES[2]!, origin: "servico", competence: "09/2026", due: "18/09/2026", dueDays: -8, expected: 300, received: 300, status: "recebido", updated: "18/09 10:20" },
  { code: "CR-1039", property: PROPERTIES[1]!, origin: "reserva", competence: "09/2026", due: "19/09/2026", dueDays: -7, expected: 1500, received: 0, status: "cancelado", updated: "17/09 11:00" },
];
const pending = (e: Entry) => (e.status === "cancelado" ? 0 : e.expected - e.received);
const rank = (e: Entry) => ({ vencido: 0, parcial: 1, revisao: 2, previsto: 3, recebido: 4, cancelado: 5 })[e.status] * 100 + e.dueDays;
const soon = (e: Entry) => (e.status === "previsto" || e.status === "revisao") && e.dueDays >= 0 && e.dueDays <= 7;

type Flag = { icon: typeof AlertTriangle; text: string } | null;
function flagOf(e: Entry): Flag {
  if (e.status === "vencido") return { icon: AlertTriangle, text: `Vencido há ${-e.dueDays} dias` };
  if (e.status === "parcial") return { icon: Hourglass, text: "Recebimento parcial" };
  if (e.status === "revisao") return { icon: SearchCheck, text: "Valor em revisão" };
  if (soon(e)) return { icon: CalendarClock, text: `Vence em ${e.dueDays} dias` };
  return null;
}
const priorityOf = (e: Entry): { label: string; tone: AdminTone } | null =>
  e.status === "vencido" || e.status === "parcial" ? { label: "Alta", tone: "danger" } : e.status === "revisao" || soon(e) ? { label: "Média", tone: "warning" } : null;

type DemoState = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const stateOptions: { value: DemoState; label: string }[] = [
  { value: "normal", label: "Normal" }, { value: "parcial", label: "Parcial" }, { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" }, { value: "indisponivel", label: "Indisponível" },
];

function ReceberPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<DemoState>("normal");
  const [period, setPeriod] = useState("2026-09");
  const [property, setProperty] = useState("todos");
  const [origin, setOrigin] = useState<"todos" | Origin>("todos");
  const [due, setDue] = useState<"todos" | "vencidos" | "7dias" | "30dias">("todos");
  const [status, setStatus] = useState<"todos" | Status>("todos");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Entry | null>(null);

  const hasData = demo === "normal" || demo === "parcial";
  const base = useMemo(() => (hasData ? ENTRIES.filter((e) => !(demo === "parcial" && e.origin === "servico")) : []), [demo, hasData]);
  const scoped = base.filter((e) => (property === "todos" || e.property === property) && (origin === "todos" || e.origin === origin));
  const list = scoped
    .filter((e) => status === "todos" || e.status === status)
    .filter((e) => due === "todos" || (due === "vencidos" ? e.dueDays < 0 : e.dueDays >= 0 && e.dueDays <= (due === "7dias" ? 7 : 30)))
    .filter((e) => !q || `${e.code} ${e.property}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => rank(a) - rank(b));

  const sum = (f: (e: Entry) => boolean, v: (e: Entry) => number = pending) => scoped.filter(f).reduce((s, e) => s + v(e), 0);
  const partialNote = demo === "parcial" ? " · pode estar incompleto" : "";
  const stats = [
    { icon: Wallet, label: "Total a receber", value: sum(() => true), nature: "Previsto" + partialNote, tone: "info" as AdminTone, mark: true },
    { icon: AlertTriangle, label: "Em atraso", value: sum((e) => e.status === "vencido" || (e.status === "parcial" && e.dueDays < 0)), nature: "Vencido", tone: "danger" as AdminTone },
    { icon: CalendarClock, label: "Vencem nos próximos 7 dias", value: sum(soon), nature: "Previsto" + partialNote, tone: "warning" as AdminTone, mark: true },
    { icon: CheckCircle2, label: "Recebido no período", value: sum(() => true, (e) => e.received), nature: "Recebido" + partialNote, tone: "success" as AdminTone, mark: true },
    { icon: SearchCheck, label: "Em revisão", value: sum((e) => e.status === "revisao"), nature: "Em análise", tone: "neutral" as AdminTone },
  ];

  const sel = "admin-input h-11 w-full px-3 text-sm";
  const filters = (
    <>
      <MonthPicker aria-label="Período" value={period} onValueChange={setPeriod} className={sel} />
      <select aria-label="Imóvel" value={property} onChange={(e) => setProperty(e.target.value)} className={sel}>
        <option value="todos">Todos os imóveis</option>
        {PROPERTIES.map((p) => <option key={p}>{p}</option>)}
      </select>
      <select aria-label="Origem" value={origin} onChange={(e) => setOrigin(e.target.value as typeof origin)} className={sel}>
        <option value="todos">Todas as origens</option>
        <option value="reserva">Reserva</option><option value="servico">Serviço</option><option value="ajuste">Ajuste</option>
      </select>
      <select aria-label="Vencimento" value={due} onChange={(e) => setDue(e.target.value as typeof due)} className={sel}>
        <option value="todos">Qualquer vencimento</option><option value="vencidos">Já vencidos</option>
        <option value="7dias">Próximos 7 dias</option><option value="30dias">Próximos 30 dias</option>
      </select>
    </>
  );

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
        <span className="font-medium">Protótipo visual · somente leitura</span>
        <div className="ml-auto hidden sm:block"><PeriodFilter value={demo} onChange={setDemo} options={stateOptions} /></div>
        <select aria-label="Estado do protótipo" value={demo} onChange={(e) => setDemo(e.target.value as DemoState)} className="admin-input h-9 w-full px-2 text-xs sm:hidden">
          {stateOptions.map((o) => <option key={o.value} value={o.value}>Estado: {o.label}</option>)}
        </select>
      </div>

      <FinanceiroPrototypeNav />

      <AdminPageHeader
        title="Contas a receber"
        description="Acompanhe valores previstos, recebidos e pendentes."
        meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>}
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <label className="admin-input flex h-11 min-w-0 items-center gap-2 px-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imóvel ou código (ex.: CR-1042)" aria-label="Buscar imóvel ou código" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="hidden contents-sm sm:contents">{filters}</div>
        <details className="admin-panel sm:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-medium text-[var(--admin-text)]">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtros
          </summary>
          <div className="grid gap-2 px-4 pb-4">{filters}</div>
        </details>
      </div>

      {demo === "parcial" && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>Dados parciais:</strong> os lançamentos de origem <strong>Serviço</strong> não foram carregados e não aparecem na lista. Podem estar incompletos: <strong>Total a receber</strong>, <strong>Vencem nos próximos 7 dias</strong> e <strong>Recebido no período</strong>. Lançamentos de reservas e ajustes estão completos.</p>
        </div>
      )}

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState icon={PlugZap} title="Contas a receber indisponíveis" description="Não foi possível carregar os lançamentos. Nenhum valor é exibido para não parecer que não há nada a receber. Tente novamente em alguns minutos." />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {stats.map((s) => (
              <AdminStatCard
                key={s.label}
                icon={s.icon}
                label={s.label}
                tone={hasData ? s.tone : "neutral"}
                value={demo === "carregando" ? <span className="admin-skeleton inline-block h-6 w-20 rounded" />
                  : demo === "vazio" ? <span className="text-base font-medium text-[var(--admin-muted)]">Sem lançamentos</span>
                  : <span className="text-lg tabular-nums sm:text-xl">{brl(s.value)}{demo === "parcial" && s.mark ? " *" : ""}</span>}
                detail={demo === "carregando" ? null : s.nature}
              />
            ))}
          </div>

          {/* Status: abas no desktop, select no celular */}
          <div className="mb-3 hidden flex-wrap gap-1 border-b border-[var(--admin-border)] md:flex" role="tablist" aria-label="Status">
            {STATUS_OPTS.map((o) => (
              <button key={o.value} role="tab" aria-selected={status === o.value} onClick={() => setStatus(o.value)}
                className={`-mb-px min-h-11 border-b-2 px-3 text-sm ${status === o.value ? "border-[var(--admin-primary)] font-semibold text-[var(--admin-text)]" : "border-transparent text-[var(--admin-muted)]"}`}>
                {o.label}
              </button>
            ))}
          </div>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="admin-input mb-3 h-11 w-full px-3 text-sm md:hidden">
            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>Status: {o.label}</option>)}
          </select>

          <div className="admin-panel">
            {demo === "carregando" ? <SkeletonRows />
              : list.length === 0 ? <AdminEmptyState title="Nenhum lançamento encontrado" description={hasData ? "Ajuste os filtros ou a busca." : "Não há contas a receber neste período."} />
              : isMobile ? (
                <ul className="divide-y divide-[var(--admin-border)]">
                  {list.map((e) => <MobileCard key={e.code} e={e} onOpen={() => setOpen(e)} />)}
                </ul>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                    <tr className="border-b border-[var(--admin-border)]">
                      <th className="w-[26%] px-4 py-2 font-medium">Lançamento</th>
                      <th className="w-[12%] px-2 py-2 font-medium">Previsto para</th>
                      <th className="w-[12%] px-2 py-2 text-right font-medium">Previsto</th>
                      <th className="w-[12%] px-2 py-2 text-right font-medium">Recebido</th>
                      <th className="w-[12%] px-2 py-2 text-right font-medium">Saldo</th>
                      <th className="w-[26%] px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {list.map((e) => {
                      const f = flagOf(e); const p = priorityOf(e);
                      return (
                        <tr key={e.code} onClick={() => setOpen(e)} tabIndex={0} onKeyDown={(k) => k.key === "Enter" && setOpen(e)}
                          className={`cursor-pointer border-l-4 hover:bg-[var(--admin-surface-muted,rgba(0,0,0,0.02))] ${p?.tone === "danger" ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--admin-text)]">{e.code} · {ORIGIN[e.origin]}</p>
                            <p className="truncate text-xs text-[var(--admin-muted)]">{e.property}</p>
                          </td>
                          <td className="px-2 py-3 tabular-nums">{e.due}</td>
                          <td className="px-2 py-3 text-right tabular-nums">{brl(e.expected)}</td>
                          <td className="px-2 py-3 text-right tabular-nums">{e.received ? brl(e.received) : "—"}</td>
                          <td className="px-2 py-3 text-right font-semibold tabular-nums">{e.status === "cancelado" ? "—" : brl(pending(e))}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <AdminStatusBadge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</AdminStatusBadge>
                              {p && <AdminStatusBadge tone={p.tone}>Prioridade {p.label.toLowerCase()}</AdminStatusBadge>}
                            </div>
                            {f && <p className="mt-1 flex items-center gap-1 text-xs text-[var(--admin-text)]"><f.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
          <p className="mt-3 text-xs text-[var(--admin-muted)]">Valores demonstrativos. Esta lista não é extrato bancário nem conciliação.</p>
        </>
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[88vh] overflow-y-auto" : "w-full overflow-y-auto sm:max-w-md"}>
          {open && <Detail e={open} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MobileCard({ e, onOpen }: { e: Entry; onOpen: () => void }) {
  const f = flagOf(e); const p = priorityOf(e);
  return (
    <li>
      <button onClick={onOpen} className={`block w-full border-l-4 px-4 py-3 text-left ${p?.tone === "danger" ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-text)]">{e.code} · {ORIGIN[e.origin]}</p>
            <p className="text-xs text-[var(--admin-muted)]">{e.property}</p>
          </div>
          <AdminStatusBadge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</AdminStatusBadge>
        </div>
        {f && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[var(--admin-text)]"><f.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text}{p ? ` · Prioridade ${p.label.toLowerCase()}` : ""}</p>}
        <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div><dt className="text-[var(--admin-muted)]">Previsto</dt><dd className="tabular-nums text-[var(--admin-text)]">{brl(e.expected)}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Recebido</dt><dd className="tabular-nums text-[var(--admin-text)]">{e.received ? brl(e.received) : "—"}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Saldo</dt><dd className="font-semibold tabular-nums text-[var(--admin-text)]">{e.status === "cancelado" ? "—" : brl(pending(e))}</dd></div>
        </dl>
        <p className="mt-1.5 text-xs text-[var(--admin-muted)]">Previsto para {e.due}</p>
      </button>
    </li>
  );
}

function Detail({ e }: { e: Entry }) {
  const timeline = [
    { when: "Lançamento criado", note: `Competência ${e.competence}` },
    ...(e.received && e.status === "parcial" ? [{ when: "Recebimento parcial registrado", note: brl(e.received) }] : []),
    ...(e.status === "recebido" ? [{ when: "Recebimento registrado", note: brl(e.received) }] : []),
    ...(e.status === "vencido" ? [{ when: "Vencimento ultrapassado", note: e.due }] : []),
    ...(e.status === "revisao" ? [{ when: "Enviado para revisão", note: "Aguardando análise financeira" }] : []),
    ...(e.status === "cancelado" ? [{ when: "Lançamento cancelado", note: "Sem saldo pendente" }] : []),
  ];
  const rows: [string, string][] = [
    ["Imóvel", e.property], ["Origem", ORIGIN[e.origin]], ["Competência", e.competence], ["Vencimento", e.due],
    ["Valor previsto", brl(e.expected)], ["Valor recebido", e.received ? brl(e.received) : "—"],
    ["Saldo pendente", e.status === "cancelado" ? "—" : brl(pending(e))], ["Status", STATUS[e.status].label],
  ];
  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle>{e.code}</SheetTitle>
        <SheetDescription>Lançamento demonstrativo · somente leitura</SheetDescription>
      </SheetHeader>
      <dl className="mt-4 divide-y divide-[var(--admin-border)] text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2">
            <dt className="text-[var(--admin-muted)]">{k}</dt><dd className="text-right font-medium text-[var(--admin-text)]">{v}</dd>
          </div>
        ))}
      </dl>
      {e.reason && (
        <div className="mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium"><SearchCheck className="h-4 w-4" aria-hidden="true" />Motivo da revisão</p>
          <p className="mt-1 text-[var(--admin-muted)]">{e.reason}</p>
        </div>
      )}
      <h3 className="mt-5 text-sm font-semibold">Linha do tempo (demonstrativa)</h3>
      <ol className="mt-2 space-y-2 border-l border-[var(--admin-border)] pl-3 text-sm">
        {timeline.map((t) => (
          <li key={t.when}><p className="text-[var(--admin-text)]">{t.when}</p><p className="text-xs text-[var(--admin-muted)]">{t.note}</p></li>
        ))}
      </ol>
      <p className="mt-5 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]"><Clock className="h-3.5 w-3.5" aria-hidden="true" />Última atualização demonstrativa: {e.updated}</p>
    </>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-[var(--admin-border)]" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2 px-4 py-4">
          <div className="admin-skeleton h-3.5 w-2/3 rounded" />
          <div className="admin-skeleton h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
