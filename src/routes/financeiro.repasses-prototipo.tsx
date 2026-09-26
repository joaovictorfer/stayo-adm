import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Ban, CalendarClock, CalendarX2, CheckCircle2, Clock, FileCheck2, History, Layers, PlugZap, Search, SearchCheck, SendHorizontal, ShieldCheck, ShieldQuestion, SlidersHorizontal, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge, type AdminTone } from "@/components/admin/AdminPrimitives";
import { FinanceiroPrototypeNav } from "@/components/admin/FinanceiroPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/financeiro/repasses-prototipo")({
  head: () => ({
    meta: [
      { title: "Repasses (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual de Repasses a proprietários do Stayo Admin, com dados demonstrativos." },
      { property: "og:title", content: "Repasses (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura, dados demonstrativos, sem validade bancária." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RepassesPrototype,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PROPERTIES = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12", "Imóvel D · 7"];
const OWNERS = ["Proprietário demo A", "Proprietário demo B", "Proprietário demo C", "Proprietário demo D"];

type Status = "aprogramar" | "revisao" | "programado" | "pago" | "falha" | "vencido" | "cancelado";
const STATUS: Record<Status, { label: string; tone: AdminTone }> = {
  aprogramar: { label: "A programar", tone: "info" },
  revisao: { label: "Em revisão", tone: "warning" },
  programado: { label: "Programado", tone: "info" },
  pago: { label: "Pago", tone: "success" },
  falha: { label: "Falha de processamento", tone: "danger" },
  vencido: { label: "Vencido", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

interface Payout {
  code: string; owner: string; property: string; period: string; periodKey: string;
  closing: string; version: number; closingSuperseded?: string; closingNet: number;
  adjustments?: { label: string; value: number }[]; amount: number; status: Status;
  date?: string; dateLabel?: string; payMonth?: string; priority?: "Alta" | "Média";
  verified: boolean; receipts: number; guidance: string;
}
const PAYOUTS: Payout[] = [
  { code: "RP-3041", owner: OWNERS[2]!, property: PROPERTIES[2]!, period: "07/2026", periodKey: "2026-07", closing: "FC-0871", version: 1, closingNet: 3920, amount: 3920, status: "vencido", date: "10/09/2026", dateLabel: "Previsto para", payMonth: "2026-09", priority: "Alta", verified: true, receipts: 0, guidance: "Data prevista ultrapassada sem pagamento registrado. Verificar programação com o financeiro." },
  { code: "RP-3048", owner: OWNERS[0]!, property: PROPERTIES[0]!, period: "07/2026", periodKey: "2026-07", closing: "FC-0884", version: 1, closingNet: 4868, amount: 4868, status: "falha", date: "15/09/2026", dateLabel: "Processado em", payMonth: "2026-09", priority: "Alta", verified: true, receipts: 0, guidance: "O processamento demonstrativo retornou falha. Nenhum valor foi considerado pago." },
  { code: "RP-3052", owner: OWNERS[1]!, property: PROPERTIES[1]!, period: "08/2026", periodKey: "2026-08", closing: "FC-0905", version: 1, closingSuperseded: "FC-0912 · v2", closingNet: 5402, amount: 5402, status: "revisao", priority: "Alta", verified: true, receipts: 0, guidance: "O fechamento de origem (v1) foi substituído pela v2. Este repasse continua vinculado à v1 e não foi alterado; a diferença deverá ser tratada como novo ajuste ou novo repasse." },
  { code: "RP-3055", owner: OWNERS[1]!, property: PROPERTIES[1]!, period: "08/2026", periodKey: "2026-08", closing: "FC-0912", version: 2, closingNet: 5742, adjustments: [{ label: "Ajuste demonstrativo: diferença v1 → v2", value: 340 }], amount: 5742, status: "aprogramar", priority: "Média", verified: false, receipts: 0, guidance: "Pronto para programação após a verificação dos dados de pagamento do proprietário." },
  { code: "RP-3058", owner: OWNERS[3]!, property: PROPERTIES[3]!, period: "08/2026", periodKey: "2026-08", closing: "FC-0898", version: 1, closingNet: 2664, amount: 2664, status: "aprogramar", priority: "Média", verified: true, receipts: 0, guidance: "Pronto para programação. Nenhuma pendência demonstrativa." },
  { code: "RP-3060", owner: OWNERS[0]!, property: PROPERTIES[0]!, period: "08/2026", periodKey: "2026-08", closing: "FC-0915", version: 1, closingNet: 4376, amount: 4376, status: "programado", date: "30/09/2026", dateLabel: "Programado para", payMonth: "2026-09", verified: true, receipts: 0, guidance: "Programado. Aguardar a data para confirmação demonstrativa." },
  { code: "RP-3036", owner: OWNERS[3]!, property: PROPERTIES[3]!, period: "07/2026", periodKey: "2026-07", closing: "FC-0866", version: 1, closingNet: 3150, adjustments: [{ label: "Ajuste demonstrativo: reembolso de compra", value: -120 }], amount: 3030, status: "pago", date: "08/09/2026", dateLabel: "Pago em", payMonth: "2026-09", verified: true, receipts: 1, guidance: "Pagamento demonstrativo registrado. Nenhuma ação pendente." },
  { code: "RP-3029", owner: OWNERS[2]!, property: PROPERTIES[2]!, period: "07/2026", periodKey: "2026-07", closing: "FC-0879", version: 1, closingNet: 0, amount: 0, status: "cancelado", verified: true, receipts: 0, guidance: "Cancelado junto com o fechamento de origem. Mantido apenas para histórico." },
];

const rank = (p: Payout) => ({ vencido: 0, falha: 1, revisao: 2, aprogramar: 3, programado: 4, pago: 5, cancelado: 6 })[p.status];

function flagOf(p: Payout) {
  if (p.status === "vencido") return { icon: CalendarX2, text: `Vencido desde ${p.date}`, strong: true };
  if (p.status === "falha") return { icon: XCircle, text: "Falha de processamento · não pago", strong: true };
  if (p.closingSuperseded) return { icon: History, text: `Fechamento substituído por ${p.closingSuperseded} · exige ajuste`, strong: true };
  if (p.status === "aprogramar") return { icon: SendHorizontal, text: p.verified ? "Pronto para programação" : "Pronto · verificação de dados pendente", strong: false };
  return null;
}

type DemoState = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const stateOptions: { value: DemoState; label: string }[] = [
  { value: "normal", label: "Normal" }, { value: "parcial", label: "Parcial" }, { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" }, { value: "indisponivel", label: "Indisponível" },
];

function RepassesPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<DemoState>("normal");
  const [period, setPeriod] = useState("todos");
  const [property, setProperty] = useState("todos");
  const [owner, setOwner] = useState("todos");
  const [status, setStatus] = useState<"todos" | Status>("todos");
  const [payMonth, setPayMonth] = useState("todos");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Payout | null>(null);

  const hasData = demo === "normal" || demo === "parcial";
  // Parcial: comprovantes e verificação de destino não carregaram; afeta programados e pagos.
  const affected = (p: Payout) => demo === "parcial" && (p.status === "programado" || p.status === "pago" || p.status === "aprogramar");
  const base = useMemo(() => (hasData ? PAYOUTS : []), [hasData]);
  const scoped = base.filter((p) => (period === "todos" || p.periodKey === period) && (property === "todos" || p.property === property) && (owner === "todos" || p.owner === owner) && (payMonth === "todos" || p.payMonth === payMonth));
  const list = scoped
    .filter((p) => status === "todos" || p.status === status)
    .filter((p) => !q || `${p.code} ${p.property} ${p.owner}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => rank(a) - rank(b));

  const count = (f: (p: Payout) => boolean) => scoped.filter(f).length;
  const inc = demo === "parcial" ? " · pode estar incompleto" : "";
  const stats = [
    { icon: SendHorizontal, label: "Prontos para programar", value: count((p) => p.status === "aprogramar"), detail: "A programar" + inc, tone: "info" as AdminTone, mark: true },
    { icon: SearchCheck, label: "Em revisão", value: count((p) => p.status === "revisao"), detail: "Em revisão", tone: "warning" as AdminTone },
    { icon: CalendarClock, label: "Programados", value: count((p) => p.status === "programado"), detail: "Programado" + inc, tone: "info" as AdminTone, mark: true },
    { icon: CheckCircle2, label: "Pagos no período", value: count((p) => p.status === "pago"), detail: "Pago" + inc, tone: "success" as AdminTone, mark: true },
    { icon: AlertTriangle, label: "Com falha ou vencidos", value: count((p) => p.status === "falha" || p.status === "vencido"), detail: "Falha de processamento ou Vencido", tone: "danger" as AdminTone },
  ];

  const cls = "admin-input h-11 w-full px-3 text-sm";
  const filters = (
    <>
      <select aria-label="Competência" value={period} onChange={(e) => setPeriod(e.target.value)} className={cls}>
        <option value="todos">Todas as competências</option><option value="2026-08">08/2026</option><option value="2026-07">07/2026</option>
      </select>
      <select aria-label="Imóvel" value={property} onChange={(e) => setProperty(e.target.value)} className={cls}>
        <option value="todos">Todos os imóveis</option>{PROPERTIES.map((p) => <option key={p}>{p}</option>)}
      </select>
      <select aria-label="Proprietário" value={owner} onChange={(e) => setOwner(e.target.value)} className={cls}>
        <option value="todos">Todos os proprietários</option>{OWNERS.map((o) => <option key={o}>{o}</option>)}
      </select>
      <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={cls}>
        <option value="todos">Todos os status</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <select aria-label="Período de pagamento" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} className={cls}>
        <option value="todos">Pagamento: todos</option><option value="2026-09">Pagamento em 09/2026</option>
      </select>
    </>
  );

  const money = (p: Payout) => (p.status === "cancelado" ? "—" : brl(p.amount));

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
        <span className="font-medium">Protótipo visual · somente leitura</span>
        <div className="ml-auto hidden sm:block"><PeriodFilter value={demo} onChange={setDemo} options={stateOptions} /></div>
        <select aria-label="Estado do protótipo" value={demo} onChange={(e) => setDemo(e.target.value as DemoState)} className="admin-input ml-auto h-9 px-2 text-xs sm:hidden">
          {stateOptions.map((o) => <option key={o.value} value={o.value}>Estado: {o.label}</option>)}
        </select>
      </div>

      <FinanceiroPrototypeNav />

      <AdminPageHeader title="Repasses" description="Acompanhe valores destinados aos proprietários." meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>} />

      <label className="admin-input mb-2 flex h-11 min-w-0 items-center gap-2 px-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imóvel, proprietário ou código" aria-label="Buscar imóvel, proprietário ou código" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="mb-4 hidden gap-2 md:grid md:grid-cols-3 xl:grid-cols-5">{filters}</div>
      <details className="admin-panel mb-4 md:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-medium text-[var(--admin-text)]">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtros
          <span className="ml-auto truncate text-xs font-normal text-[var(--admin-muted)]">{status === "todos" ? "Todos os status" : STATUS[status].label}</span>
        </summary>
        <div className="grid gap-2 px-4 pb-4">{filters}</div>
      </details>

      {demo === "parcial" && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>Dados parciais:</strong> os comprovantes e a verificação dos dados de pagamento não foram carregados. Os fechamentos de origem estão completos. Nos repasses <strong>A programar</strong>, <strong>Programado</strong> e <strong>Pago</strong>, a verificação e os comprovantes aparecem como “Não carregado”, e os indicadores <strong>Prontos para programar</strong>, <strong>Programados</strong> e <strong>Pagos no período</strong> (marcados com “*”) podem estar incompletos.</p>
        </div>
      )}

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState icon={PlugZap} title="Repasses indisponíveis" description="Não foi possível carregar os repasses. Nenhum valor é exibido para não parecer que não há repasses. Tente novamente em alguns minutos." />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {stats.map((s) => (
              <AdminStatCard key={s.label} icon={s.icon} label={s.label} tone={hasData ? s.tone : "neutral"}
                value={demo === "carregando" ? <span className="admin-skeleton inline-block h-6 w-12 rounded" />
                  : demo === "vazio" ? <span className="text-base font-medium text-[var(--admin-muted)]">Nenhum</span>
                  : <span className="text-xl tabular-nums">{s.value}{demo === "parcial" && s.mark ? " *" : ""}</span>}
                detail={demo === "carregando" ? null : s.detail} />
            ))}
          </div>

          <div className="admin-panel">
            {demo === "carregando" ? <SkeletonRows />
              : list.length === 0 ? <AdminEmptyState title="Nenhum repasse encontrado" description={hasData ? "Ajuste os filtros ou a busca." : "Não há repasses para este período."} />
              : isMobile ? (
                <ul className="divide-y divide-[var(--admin-border)]">{list.map((p) => <MobileCard key={p.code} p={p} money={money} partial={affected(p)} onOpen={() => setSel(p)} />)}</ul>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                    <tr className="border-b border-[var(--admin-border)]">
                      <th className="w-[27%] px-4 py-2 font-medium">Repasse · Proprietário</th>
                      <th className="w-[17%] px-2 py-2 font-medium">Origem</th>
                      <th className="w-[13%] px-2 py-2 text-right font-medium">Líquido previsto</th>
                      <th className="w-[13%] px-2 py-2 font-medium">Data</th>
                      <th className="w-[30%] px-4 py-2 font-medium">Status · Prioridade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {list.map((p) => {
                      const f = flagOf(p);
                      return (
                        <tr key={p.code} onClick={() => setSel(p)} tabIndex={0} onKeyDown={(k) => k.key === "Enter" && setSel(p)}
                          className={`cursor-pointer border-l-4 ${f?.strong ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--admin-text)]">{p.code} · {p.property}</p>
                            <p className="truncate text-xs text-[var(--admin-muted)]">{p.owner}</p>
                          </td>
                          <td className="px-2 py-3"><OriginTag p={p} /><p className="mt-1 text-xs text-[var(--admin-muted)]">Competência {p.period}</p></td>
                          <td className="px-2 py-3 text-right font-semibold tabular-nums">{money(p)}</td>
                          <td className="px-2 py-3 text-xs">{p.date ? <><span className="block text-[var(--admin-muted)]">{p.dateLabel}</span>{p.date}</> : <span className="text-[var(--admin-muted)]">Sem data</span>}</td>
                          <td className="px-4 py-3">
                            <StatusLine p={p} />
                            {f && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--admin-text)]"><f.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
          <p className="mt-3 text-xs text-[var(--admin-muted)]">Valores demonstrativos. Cada repasse permanece vinculado à versão exata do fechamento que o originou; correções geram novo ajuste ou novo repasse. Sem validade bancária, contábil ou de pagamento.</p>
        </>
      )}

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[88vh] overflow-y-auto" : "w-full overflow-y-auto sm:max-w-md"}>
          {sel && <Detail p={sel} partial={affected(sel)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OriginTag({ p }: { p: Payout }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-xs font-medium tabular-nums text-[var(--admin-text)]">
      <Layers className="h-3 w-3" aria-hidden="true" />{p.closing} · v{p.version}
    </span>
  );
}

function StatusLine({ p }: { p: Payout }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AdminStatusBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</AdminStatusBadge>
      {p.priority && <span className="text-xs font-medium text-[var(--admin-text)]">Prioridade {p.priority.toLowerCase()}</span>}
    </div>
  );
}

function MobileCard({ p, money, partial, onOpen }: { p: Payout; money: (p: Payout) => string; partial: boolean; onOpen: () => void }) {
  const f = flagOf(p);
  return (
    <li>
      <button onClick={onOpen} className={`block w-full border-l-4 px-4 py-3 text-left ${f?.strong ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-text)]">{p.code} · {p.property}</p>
            <p className="text-xs text-[var(--admin-muted)]">{p.owner}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums text-[var(--admin-text)]">{money(p)}</p>
            <p className="text-[11px] text-[var(--admin-muted)]">Líquido previsto</p>
          </div>
        </div>
        {f && <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-[var(--admin-text)]"><f.icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text}</p>}
        <div className="mt-2"><StatusLine p={p} /></div>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div><dt className="text-[var(--admin-muted)]">Origem · Competência</dt><dd className="font-medium tabular-nums text-[var(--admin-text)]">{p.closing} · v{p.version} · {p.period}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">{p.date ? p.dateLabel : "Data"}</dt><dd className="font-medium tabular-nums text-[var(--admin-text)]">{p.date ?? "Sem data"}</dd></div>
        </dl>
        {partial && <p className="mt-1.5 text-xs text-[var(--admin-muted)]">* Verificação e comprovantes não carregados</p>}
      </button>
    </li>
  );
}

function Detail({ p, partial }: { p: Payout; partial: boolean }) {
  const m = (n: number) => (p.status === "cancelado" ? "—" : brl(n));
  const timeline = [
    { t: `Gerado a partir de ${p.closing} · v${p.version}`, n: `Competência ${p.period}` },
    ...(p.closingSuperseded ? [{ t: `Fechamento substituído por ${p.closingSuperseded}`, n: "Repasse mantido na v1, sem alteração" }] : []),
    ...(p.status === "programado" || p.status === "pago" || p.status === "falha" || p.status === "vencido" ? [{ t: "Programado", n: "Demonstrativo" }] : []),
    ...(p.status === "falha" ? [{ t: "Falha de processamento", n: p.date! }] : []),
    ...(p.status === "vencido" ? [{ t: "Data prevista ultrapassada", n: p.date! }] : []),
    ...(p.status === "pago" ? [{ t: "Pagamento registrado", n: p.date! }] : []),
    ...(p.status === "cancelado" ? [{ t: "Repasse cancelado", n: "Mantido para histórico" }] : []),
  ];
  const rows: [string, React.ReactNode][] = [
    ["Proprietário", p.owner], ["Imóvel", p.property], ["Competência", p.period],
    ["Fechamento de origem", `${p.closing} · v${p.version}`], ["Status", STATUS[p.status].label],
    [p.dateLabel ?? "Data", p.date ?? "Ainda sem data"],
  ];
  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle>{p.code}</SheetTitle>
        <SheetDescription>Repasse demonstrativo · somente leitura</SheetDescription>
      </SheetHeader>

      {p.closingSuperseded && (
        <div className="mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-[var(--admin-text)]"><History className="h-4 w-4" aria-hidden="true" />Fechamento de origem substituído</p>
          <p className="mt-1 text-[var(--admin-muted)]">Este repasse continua vinculado a {p.closing} · v{p.version}. A versão {p.closingSuperseded} não altera este repasse; a correção será um novo ajuste ou novo repasse.</p>
        </div>
      )}

      <dl className="mt-4 divide-y divide-[var(--admin-border)] text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2"><dt className="text-[var(--admin-muted)]">{k}</dt><dd className="text-right font-medium text-[var(--admin-text)]">{v}</dd></div>
        ))}
      </dl>

      <h3 className="mt-5 text-sm font-semibold">Valores demonstrativos</h3>
      <dl className="mt-2 divide-y divide-[var(--admin-border)] text-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2"><dt>Líquido do fechamento</dt><dd className="text-right font-medium tabular-nums">{m(p.closingNet)}</dd></div>
        {(p.adjustments ?? []).map((a) => (
          <div key={a.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2"><dt className="text-[var(--admin-muted)]">{a.label}</dt><dd className="text-right tabular-nums">{a.value > 0 ? "+" : "−"}{brl(Math.abs(a.value))}</dd></div>
        ))}
        {p.adjustments?.some((a) => a.label.includes("v1 → v2")) && <p className="py-2 text-xs text-[var(--admin-muted)]">Diferença já contida no líquido da v2; exibida apenas para rastreio.</p>}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5"><dt className="font-semibold">Valor do repasse</dt><dd className="text-right text-base font-semibold tabular-nums">{m(p.amount)}</dd></div>
      </dl>

      <div className="mt-4 grid gap-2 text-sm">
        <p className="flex items-center gap-1.5">
          {partial ? <><ShieldQuestion className="h-4 w-4 shrink-0" aria-hidden="true" />Dados de pagamento: não carregado *</>
            : p.verified ? <><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />Dados de pagamento verificados</>
            : <><ShieldQuestion className="h-4 w-4 shrink-0" aria-hidden="true" />Verificação pendente</>}
        </p>
        <p className="flex items-center gap-1.5"><FileCheck2 className="h-4 w-4 shrink-0" aria-hidden="true" />Comprovantes: {partial ? "não carregado *" : p.receipts}</p>
      </div>

      <h3 className="mt-5 text-sm font-semibold">Linha do tempo (demonstrativa)</h3>
      <ol className="mt-2 space-y-2 border-l border-[var(--admin-border)] pl-3 text-sm">
        {timeline.map((x) => <li key={x.t}><p className="text-[var(--admin-text)]">{x.t}</p><p className="text-xs text-[var(--admin-muted)]">{x.n}</p></li>)}
      </ol>
      <div className="mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium">{p.status === "cancelado" ? <Ban className="h-4 w-4" aria-hidden="true" /> : <FileCheck2 className="h-4 w-4" aria-hidden="true" />}Orientação (demonstrativa)</p>
        <p className="mt-1 text-[var(--admin-muted)]">{p.guidance}</p>
      </div>
      <p className="mt-5 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]"><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Sem banco, agência, conta, Pix, documentos ou dados de hóspedes nesta visualização.</p>
    </>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-[var(--admin-border)]" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2 px-4 py-4"><div className="admin-skeleton h-3.5 w-2/3 rounded" /><div className="admin-skeleton h-3 w-1/2 rounded" /></div>
      ))}
    </div>
  );
}
