import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarX2, CheckCircle2, Clock, FileCheck2, FilePen, History, Layers, PlugZap, Search, SearchCheck, Send, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge, type AdminTone } from "@/components/admin/AdminPrimitives";
import { FinanceiroPrototypeNav } from "@/components/admin/FinanceiroPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/financeiro/fechamentos-prototipo")({
  head: () => ({
    meta: [
      { title: "Fechamentos (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual de Fechamentos financeiros do Stayo Admin, com dados demonstrativos." },
      { property: "og:title", content: "Fechamentos (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura, dados demonstrativos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FechamentosPrototype,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PROPERTIES = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12", "Imóvel D · 7"];
const RESPONSAVEIS = ["Financeiro demo 1", "Financeiro demo 2"];

type Status = "elaboracao" | "revisao" | "disponibilizado" | "liquidado" | "cancelado" | "substituido";
const STATUS: Record<Status, { label: string; tone: AdminTone }> = {
  elaboracao: { label: "Em elaboração", tone: "neutral" },
  revisao: { label: "Em revisão", tone: "warning" },
  disponibilizado: { label: "Disponibilizado", tone: "info" },
  liquidado: { label: "Liquidado", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
  substituido: { label: "Substituído", tone: "neutral" },
};

interface Closing {
  code: string; property: string; period: string; periodKey: string; owner: string; version: number;
  replaces?: string; replacedBy?: string; gross: number; deductions: number; mgmt: number; net: number;
  status: Status; releasedAt?: string; resp: string; overdue?: boolean; bookings: number; guidance: string;
}
const CLOSINGS: Closing[] = [
  { code: "FC-0912", property: PROPERTIES[1]!, period: "08/2026", periodKey: "2026-08", owner: "Proprietário demo B", version: 2, replaces: "FC-0905", gross: 9840, deductions: 2130, mgmt: 1968, net: 5742, status: "disponibilizado", releasedAt: "12/09/2026", resp: RESPONSAVEIS[0]!, bookings: 11, guidance: "Versão 2 disponibilizada após correção de uma despesa lançada em duplicidade na v1. Aguardando liquidação do repasse." },
  { code: "FC-0905", property: PROPERTIES[1]!, period: "08/2026", periodKey: "2026-08", owner: "Proprietário demo B", version: 1, replacedBy: "FC-0912", gross: 9840, deductions: 2470, mgmt: 1968, net: 5402, status: "substituido", releasedAt: "05/09/2026", resp: RESPONSAVEIS[0]!, bookings: 11, guidance: "Versão preservada para consulta. Foi substituída pela v2; nenhum valor desta versão foi apagado ou alterado." },
  { code: "FC-0915", property: PROPERTIES[0]!, period: "08/2026", periodKey: "2026-08", owner: "Proprietário demo A", version: 1, gross: 7320, deductions: 1480, mgmt: 1464, net: 4376, status: "revisao", resp: RESPONSAVEIS[1]!, bookings: 8, guidance: "Aguardando revisão financeira. Conferir despesas de manutenção antes de disponibilizar." },
  { code: "FC-0918", property: PROPERTIES[2]!, period: "08/2026", periodKey: "2026-08", owner: "Proprietário demo C", version: 1, gross: 5160, deductions: 980, mgmt: 1032, net: 3148, status: "elaboracao", resp: RESPONSAVEIS[1]!, overdue: true, bookings: 6, guidance: "Competência encerrada há mais de 20 dias sem fechamento concluído. Priorizar a conferência das receitas." },
  { code: "FC-0898", property: PROPERTIES[3]!, period: "08/2026", periodKey: "2026-08", owner: "Proprietário demo D", version: 1, gross: 4280, deductions: 760, mgmt: 856, net: 2664, status: "liquidado", releasedAt: "03/09/2026", resp: RESPONSAVEIS[0]!, bookings: 5, guidance: "Fechamento liquidado. Nenhuma ação pendente." },
  { code: "FC-0884", property: PROPERTIES[0]!, period: "07/2026", periodKey: "2026-07", owner: "Proprietário demo A", version: 1, gross: 8110, deductions: 1620, mgmt: 1622, net: 4868, status: "liquidado", releasedAt: "06/08/2026", resp: RESPONSAVEIS[1]!, bookings: 9, guidance: "Fechamento liquidado. Nenhuma ação pendente." },
  { code: "FC-0879", property: PROPERTIES[2]!, period: "07/2026", periodKey: "2026-07", owner: "Proprietário demo C", version: 1, gross: 0, deductions: 0, mgmt: 0, net: 0, status: "cancelado", resp: RESPONSAVEIS[0]!, bookings: 0, guidance: "Fechamento cancelado por lançamento em competência errada. Mantido apenas para histórico." },
];

const rank = (c: Closing) => (c.overdue ? 0 : c.status === "revisao" ? 1 : c.status === "elaboracao" ? 2 : c.status === "disponibilizado" ? 3 : c.status === "liquidado" ? 4 : c.status === "substituido" ? 5 : 6);

function flagOf(c: Closing) {
  if (c.overdue) return { icon: CalendarX2, text: "Competência vencida sem fechamento", strong: true };
  if (c.status === "revisao") return { icon: SearchCheck, text: "Aguardando revisão", strong: true };
  if (c.status === "disponibilizado") return { icon: Send, text: "Disponibilizado · repasse não liquidado", strong: false };
  if (c.status === "substituido") return { icon: History, text: `Substituída por ${c.replacedBy} · preservada para consulta`, strong: false };
  return null;
}

type DemoState = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const stateOptions: { value: DemoState; label: string }[] = [
  { value: "normal", label: "Normal" }, { value: "parcial", label: "Parcial" }, { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" }, { value: "indisponivel", label: "Indisponível" },
];

function FechamentosPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<DemoState>("normal");
  const [period, setPeriod] = useState("todos");
  const [property, setProperty] = useState("todos");
  const [status, setStatus] = useState<"todos" | Status>("todos");
  const [resp, setResp] = useState("todos");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Closing | null>(null);

  const hasData = demo === "normal" || demo === "parcial";
  const partialAffected = (c: Closing) => demo === "parcial" && (c.status === "elaboracao" || c.status === "revisao");
  const base = useMemo(() => (hasData ? CLOSINGS : []), [hasData]);
  const scoped = base.filter((c) => (period === "todos" || c.periodKey === period) && (property === "todos" || c.property === property) && (resp === "todos" || c.resp === resp));
  const list = scoped
    .filter((c) => status === "todos" || c.status === status)
    .filter((c) => !q || `${c.code} ${c.property}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => rank(a) - rank(b));

  const count = (f: (c: Closing) => boolean) => scoped.filter(f).length;
  const inc = demo === "parcial" ? " · pode estar incompleto" : "";
  const stats = [
    { icon: FilePen, label: "Em elaboração", value: count((c) => c.status === "elaboracao"), detail: "Fechamentos" + inc, tone: "neutral" as AdminTone, mark: true },
    { icon: SearchCheck, label: "Em revisão", value: count((c) => c.status === "revisao"), detail: "Aguardando revisão" + inc, tone: "warning" as AdminTone, mark: true },
    { icon: Send, label: "A disponibilizar", value: count((c) => c.status === "revisao" || c.status === "elaboracao"), detail: "Ainda não visíveis ao proprietário" + inc, tone: "info" as AdminTone, mark: true },
    { icon: CheckCircle2, label: "Liquidados", value: count((c) => c.status === "liquidado"), detail: "Repasse liquidado", tone: "success" as AdminTone },
    { icon: Layers, label: "Com versão substituída", value: count((c) => !!c.replaces), detail: "Nova versão publicada", tone: "neutral" as AdminTone },
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
      <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={cls}>
        <option value="todos">Todos os status</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <select aria-label="Responsável" value={resp} onChange={(e) => setResp(e.target.value)} className={cls}>
        <option value="todos">Todos os responsáveis</option>{RESPONSAVEIS.map((r) => <option key={r}>{r}</option>)}
      </select>
    </>
  );

  const money = (c: Closing, n: number) => (c.status === "cancelado" ? "—" : partialAffected(c) ? `${brl(n)} *` : brl(n));

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

      <AdminPageHeader title="Fechamentos" description="Acompanhe resultados por imóvel e período." meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>} />

      <label className="admin-input mb-2 flex h-11 min-w-0 items-center gap-2 px-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imóvel ou código" aria-label="Buscar imóvel ou código" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="mb-4 hidden gap-2 md:grid md:grid-cols-4">{filters}</div>
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
          <p><strong>Dados parciais:</strong> a atualização de despesas do período não respondeu. Os valores dos fechamentos <strong>Em elaboração</strong> e <strong>Em revisão</strong> podem estar incompletos (marcados com “*”), assim como os indicadores <strong>Em elaboração</strong>, <strong>Em revisão</strong> e <strong>A disponibilizar</strong>. Fechamentos disponibilizados, liquidados e substituídos são versões fechadas e não são afetados.</p>
        </div>
      )}

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState icon={PlugZap} title="Fechamentos indisponíveis" description="Não foi possível carregar os fechamentos. Nenhum valor é exibido para não parecer que não há resultados ou repasses. Tente novamente em alguns minutos." />
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
              : list.length === 0 ? <AdminEmptyState title="Nenhum fechamento encontrado" description={hasData ? "Ajuste os filtros ou a busca." : "Não há fechamentos para este período."} />
              : isMobile ? (
                <ul className="divide-y divide-[var(--admin-border)]">{list.map((c) => <MobileCard key={c.code} c={c} money={money} onOpen={() => setSel(c)} />)}</ul>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                    <tr className="border-b border-[var(--admin-border)]">
                      <th className="w-[28%] px-4 py-2 font-medium">Fechamento</th>
                      <th className="w-[12%] px-2 py-2 text-right font-medium">Receita bruta</th>
                      <th className="w-[13%] px-2 py-2 text-right font-medium">Despesas e deduções</th>
                      <th className="w-[13%] px-2 py-2 text-right font-medium">Líquido previsto</th>
                      <th className="w-[34%] px-4 py-2 font-medium">Status · Versão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {list.map((c) => {
                      const f = flagOf(c);
                      return (
                        <tr key={c.code} onClick={() => setSel(c)} tabIndex={0} onKeyDown={(k) => k.key === "Enter" && setSel(c)}
                          className={`cursor-pointer border-l-4 ${f?.strong ? "border-l-[var(--admin-warning,#b54708)]" : "border-l-transparent"} ${c.status === "substituido" ? "bg-[var(--admin-surface-muted,transparent)]" : ""}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--admin-text)]">{c.code} · {c.property}</p>
                            <p className="truncate text-xs text-[var(--admin-muted)]">Competência {c.period} · {c.owner}</p>
                          </td>
                          <td className="px-2 py-3 text-right tabular-nums">{money(c, c.gross)}</td>
                          <td className="px-2 py-3 text-right tabular-nums">{money(c, c.deductions)}</td>
                          <td className="px-2 py-3 text-right font-semibold tabular-nums">{money(c, c.net)}</td>
                          <td className="px-4 py-3">
                            <StatusLine c={c} />
                            {f && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--admin-text)]"><f.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
          <p className="mt-3 text-xs text-[var(--admin-muted)]">Valores demonstrativos. Fechamentos disponibilizados são versões fechadas: correções geram nova versão e a anterior permanece consultável. Sem validade contábil.</p>
        </>
      )}

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[88vh] overflow-y-auto" : "w-full overflow-y-auto sm:max-w-md"}>
          {sel && <Detail c={sel} partial={partialAffected(sel)} onOpen={(code) => setSel(CLOSINGS.find((x) => x.code === code) ?? null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function VersionTag({ c }: { c: Closing }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-xs font-medium text-[var(--admin-text)]">
      <Layers className="h-3 w-3" aria-hidden="true" />v{c.version}{c.replaces ? " substitui v1" : ""}
    </span>
  );
}

function StatusLine({ c }: { c: Closing }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AdminStatusBadge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</AdminStatusBadge>
      <VersionTag c={c} />
      {c.releasedAt && <span className="text-xs text-[var(--admin-muted)]">Disponibilizado em {c.releasedAt}</span>}
    </div>
  );
}

function MobileCard({ c, money, onOpen }: { c: Closing; money: (c: Closing, n: number) => string; onOpen: () => void }) {
  const f = flagOf(c);
  return (
    <li>
      <button onClick={onOpen} className={`block w-full border-l-4 px-4 py-3 text-left ${f?.strong ? "border-l-[var(--admin-warning,#b54708)]" : "border-l-transparent"}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-text)]">{c.code} · {c.property}</p>
            <p className="text-xs text-[var(--admin-muted)]">Competência {c.period} · {c.owner}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums text-[var(--admin-text)]">{money(c, c.net)}</p>
            <p className="text-[11px] text-[var(--admin-muted)]">Líquido previsto</p>
          </div>
        </div>
        {f && <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-[var(--admin-text)]"><f.icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text}</p>}
        <div className="mt-2"><StatusLine c={c} /></div>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div><dt className="text-[var(--admin-muted)]">Receita bruta</dt><dd className="font-medium tabular-nums text-[var(--admin-text)]">{money(c, c.gross)}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Despesas e deduções</dt><dd className="font-medium tabular-nums text-[var(--admin-text)]">{money(c, c.deductions)}</dd></div>
        </dl>
      </button>
    </li>
  );
}

function Detail({ c, partial, onOpen }: { c: Closing; partial: boolean; onOpen: (code: string) => void }) {
  const m = (n: number) => (c.status === "cancelado" ? "—" : `${brl(n)}${partial ? " *" : ""}`);
  const timeline = [
    { t: "Fechamento iniciado", n: `Competência ${c.period}` },
    ...(c.status !== "elaboracao" && c.status !== "cancelado" ? [{ t: "Enviado para revisão", n: c.resp }] : []),
    ...(c.releasedAt ? [{ t: `Versão ${c.version} disponibilizada ao proprietário`, n: c.releasedAt }] : []),
    ...(c.status === "substituido" ? [{ t: `Substituída por ${c.replacedBy}`, n: "Versão preservada, sem alteração" }] : []),
    ...(c.status === "liquidado" ? [{ t: "Repasse liquidado", n: "Demonstrativo" }] : []),
    ...(c.status === "cancelado" ? [{ t: "Fechamento cancelado", n: "Mantido para histórico" }] : []),
  ];
  const rows: [string, React.ReactNode][] = [
    ["Imóvel", c.property], ["Competência", c.period], ["Proprietário", c.owner], ["Responsável", c.resp],
    ["Status", STATUS[c.status].label], ["Disponibilização", c.releasedAt ?? "Ainda não disponibilizado"],
  ];
  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle>{c.code} · v{c.version}</SheetTitle>
        <SheetDescription>Fechamento demonstrativo · somente leitura</SheetDescription>
      </SheetHeader>

      {(c.replaces || c.replacedBy) && (
        <div className="mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-[var(--admin-text)]"><History className="h-4 w-4" aria-hidden="true" />
            {c.replaces ? `v${c.version} substitui v1 (${c.replaces})` : `Esta versão foi substituída por ${c.replacedBy}`}
          </p>
          <p className="mt-1 text-[var(--admin-muted)]">A versão anterior não foi apagada nem alterada e continua consultável.</p>
          <button onClick={() => onOpen((c.replaces ?? c.replacedBy)!)} className="mt-2 min-h-10 text-sm font-medium text-[var(--admin-primary)] underline underline-offset-2">
            {c.replaces ? "Ver versão anterior (v1)" : "Ver versão atual (v2)"}
          </button>
        </div>
      )}

      <dl className="mt-4 divide-y divide-[var(--admin-border)] text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2"><dt className="text-[var(--admin-muted)]">{k}</dt><dd className="text-right font-medium text-[var(--admin-text)]">{v}</dd></div>
        ))}
      </dl>

      <h3 className="mt-5 text-sm font-semibold">Resumo demonstrativo</h3>
      {partial && <p className="mt-1 text-xs text-[var(--admin-muted)]">* Despesas do período podem estar incompletas.</p>}
      <dl className="mt-2 divide-y divide-[var(--admin-border)] text-sm">
        {([
          ["Receitas de hospedagem", m(c.gross), `${c.bookings} hospedagens no período`],
          ["Despesas e deduções", m(c.deductions), "Limpezas, manutenção e contas do imóvel"],
          ["Receita de gestão estimada", m(c.mgmt), "Taxa de administração sobre a receita"],
        ] as const).map(([k, v, n]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2">
            <dt><span className="text-[var(--admin-text)]">{k}</span><span className="block text-xs text-[var(--admin-muted)]">{n}</span></dt>
            <dd className="text-right font-medium tabular-nums">{v}</dd>
          </div>
        ))}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5">
          <dt className="font-semibold text-[var(--admin-text)]">Líquido previsto para repasse</dt>
          <dd className="text-right text-base font-semibold tabular-nums">{m(c.net)}</dd>
        </div>
      </dl>

      <h3 className="mt-5 text-sm font-semibold">Linha do tempo (demonstrativa)</h3>
      <ol className="mt-2 space-y-2 border-l border-[var(--admin-border)] pl-3 text-sm">
        {timeline.map((x) => <li key={x.t}><p className="text-[var(--admin-text)]">{x.t}</p><p className="text-xs text-[var(--admin-muted)]">{x.n}</p></li>)}
      </ol>
      <div className="mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium"><FileCheck2 className="h-4 w-4" aria-hidden="true" />Orientação financeira (demonstrativa)</p>
        <p className="mt-1 text-[var(--admin-muted)]">{c.guidance}</p>
      </div>
      <p className="mt-5 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]"><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Sem dados bancários, Pix, documentos ou dados de hóspedes nesta visualização.</p>
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
