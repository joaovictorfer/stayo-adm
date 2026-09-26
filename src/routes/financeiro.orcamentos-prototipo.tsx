import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, CalendarX2, CheckCircle2, Clock, FilePen, FileText, Flame, History, Hourglass, Info, Paperclip, PlugZap, Search, SlidersHorizontal, Store } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge, type AdminTone } from "@/components/admin/AdminPrimitives";
import { FinanceiroPrototypeNav } from "@/components/admin/FinanceiroPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/financeiro/orcamentos-prototipo")({
  head: () => ({
    meta: [
      { title: "Orçamentos (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual de Orçamentos de serviços do Stayo Admin, com dados demonstrativos." },
      { property: "og:title", content: "Orçamentos (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura, sem validade fiscal ou contábil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrcamentosPrototype,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PROPERTIES = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12", "Imóvel D · 7"];
const SUPPLIERS = ["Fornecedor demo 1", "Fornecedor demo 2", "Fornecedor demo 3"];
const SERVICES = ["Manutenção", "Limpeza pós-obra", "Enxoval", "Marcenaria", "Climatização"];

type Status = "preparacao" | "apresentado" | "aguardando" | "aprovado" | "recusado" | "expirado" | "substituido";
const STATUS: Record<Status, { label: string; tone: AdminTone }> = {
  preparacao: { label: "Em preparação", tone: "neutral" }, apresentado: { label: "Apresentado", tone: "info" },
  aguardando: { label: "Aguardando decisão", tone: "warning" }, aprovado: { label: "Aprovado", tone: "success" },
  recusado: { label: "Recusado", tone: "neutral" }, expirado: { label: "Expirado", tone: "danger" }, substituido: { label: "Substituído", tone: "neutral" },
};

interface Quote {
  code: string; version: number; replaces?: string; replacedBy?: string; property: string; service: string; supplier: string;
  scope: string; value: number; validUntil: string; daysLeft: number; status: Status; urgent?: boolean; attachments: number;
  periodKey: string; guidance: string;
}
const Q: Quote[] = [
  { code: "OR-7021", version: 1, property: PROPERTIES[0]!, service: SERVICES[4]!, supplier: SUPPLIERS[0]!, scope: "Troca do compressor do ar-condicionado da suíte.", value: 2380, validUntil: "28/09/2026", daysLeft: 2, status: "aguardando", urgent: true, attachments: 2, periodKey: "2026-09", guidance: "Serviço urgente: suíte sem climatização. Confirmar a decisão do proprietário antes do vencimento." },
  { code: "OR-7015", version: 2, replaces: "OR-7008", property: PROPERTIES[1]!, service: SERVICES[3]!, supplier: SUPPLIERS[1]!, scope: "Armário planejado da cozinha com ferragens reforçadas.", value: 4650, validUntil: "10/10/2026", daysLeft: 14, status: "apresentado", attachments: 3, periodKey: "2026-09", guidance: "Versão 2 após renegociação do escopo. Aguardar retorno do proprietário." },
  { code: "OR-7008", version: 1, replacedBy: "OR-7015", property: PROPERTIES[1]!, service: SERVICES[3]!, supplier: SUPPLIERS[1]!, scope: "Armário planejado da cozinha.", value: 5200, validUntil: "30/09/2026", daysLeft: 4, status: "substituido", attachments: 2, periodKey: "2026-09", guidance: "Versão preservada para consulta; substituída pela v2 sem alteração." },
  { code: "OR-7024", version: 1, property: PROPERTIES[2]!, service: SERVICES[0]!, supplier: SUPPLIERS[2]!, scope: "Revisão da instalação hidráulica do banheiro social.", value: 780, validUntil: "01/10/2026", daysLeft: 5, status: "aguardando", attachments: 1, periodKey: "2026-09", guidance: "Decisão pendente. Vence em 5 dias." },
  { code: "OR-7027", version: 1, property: PROPERTIES[3]!, service: SERVICES[2]!, supplier: SUPPLIERS[2]!, scope: "Complemento de enxoval: toalhas e lençóis.", value: 1120, validUntil: "—", daysLeft: 99, status: "preparacao", attachments: 0, periodKey: "2026-09", guidance: "Aguardando proposta final do fornecedor." },
  { code: "OR-6990", version: 1, property: PROPERTIES[0]!, service: SERVICES[1]!, supplier: SUPPLIERS[0]!, scope: "Limpeza pós-obra após pintura.", value: 400, validUntil: "15/09/2026", daysLeft: -11, status: "aprovado", attachments: 1, periodKey: "2026-09", guidance: "Aprovado pelo proprietário. Pagamento direto ao fornecedor; nada foi lançado automaticamente." },
  { code: "OR-6982", version: 1, property: PROPERTIES[2]!, service: SERVICES[4]!, supplier: SUPPLIERS[1]!, scope: "Instalação de ar-condicionado na sala.", value: 3100, validUntil: "18/09/2026", daysLeft: -8, status: "expirado", attachments: 2, periodKey: "2026-09", guidance: "Validade encerrada sem decisão. Uma nova proposta exigirá nova versão." },
  { code: "OR-6975", version: 1, property: PROPERTIES[3]!, service: SERVICES[0]!, supplier: SUPPLIERS[0]!, scope: "Troca de piso da varanda.", value: 2900, validUntil: "10/09/2026", daysLeft: -16, status: "recusado", attachments: 1, periodKey: "2026-08", guidance: "Recusado pelo proprietário. Mantido para histórico." },
];

const open = (q: Quote) => q.status === "apresentado" || q.status === "aguardando";
const soon = (q: Quote) => open(q) && q.daysLeft <= 7;
const rank = (q: Quote) => (q.urgent ? 0 : q.status === "expirado" ? 1 : soon(q) ? 2 : q.status === "aguardando" ? 3 : q.status === "apresentado" ? 4 : q.status === "preparacao" ? 5 : q.status === "aprovado" ? 6 : q.status === "substituido" ? 7 : 8);

function flagOf(q: Quote) {
  if (q.urgent) return { icon: Flame, text: `Serviço urgente · vence em ${q.daysLeft} dias`, strong: true };
  if (q.status === "expirado") return { icon: CalendarX2, text: `Expirado em ${q.validUntil}`, strong: true };
  if (soon(q)) return { icon: CalendarClock, text: `Vence em ${q.daysLeft} dias`, strong: true };
  if (q.status === "aguardando") return { icon: Hourglass, text: "Aguardando decisão do proprietário", strong: false };
  if (q.status === "substituido") return { icon: History, text: `Substituído por ${q.replacedBy} · preservado para consulta`, strong: false };
  return null;
}

type DemoState = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const stateOptions: { value: DemoState; label: string }[] = [
  { value: "normal", label: "Normal" }, { value: "parcial", label: "Parcial" }, { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" }, { value: "indisponivel", label: "Indisponível" },
];

function OrcamentosPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<DemoState>("normal");
  const [fl, setFl] = useState({ property: "todos", service: "todos", supplier: "todos", status: "todos", validity: "todos", period: "todos" });
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Quote | null>(null);
  const set = (k: keyof typeof fl) => (e: React.ChangeEvent<HTMLSelectElement>) => setFl({ ...fl, [k]: e.target.value });

  const hasData = demo === "normal" || demo === "parcial";
  // Parcial: fonte do status de decisão do proprietário não respondeu.
  const affected = (x: Quote) => demo === "parcial" && open(x);
  const base = useMemo(() => (hasData ? Q : []), [hasData]);
  const scoped = base.filter((x) => (fl.property === "todos" || x.property === fl.property) && (fl.service === "todos" || x.service === fl.service) && (fl.supplier === "todos" || x.supplier === fl.supplier) && (fl.period === "todos" || x.periodKey === fl.period));
  const list = scoped
    .filter((x) => (fl.status === "todos" || x.status === fl.status) && (fl.validity === "todos" || (fl.validity === "7d" ? soon(x) : x.status === "expirado")))
    .filter((x) => !q || `${x.code} ${x.property} ${x.supplier}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => rank(a) - rank(b));

  const count = (fn: (x: Quote) => boolean) => scoped.filter(fn).length;
  const inc = demo === "parcial" ? " · pode estar incompleto" : "";
  const stats = [
    { icon: FilePen, label: "Em preparação", value: count((x) => x.status === "preparacao"), detail: "Proposta ainda não apresentada", tone: "neutral" as AdminTone },
    { icon: Hourglass, label: "Aguardando decisão", value: count(open), detail: "Apresentado ou aguardando" + inc, tone: "warning" as AdminTone, mark: true },
    { icon: CalendarClock, label: "Vencem nos próximos 7 dias", value: count(soon), detail: "Validade próxima", tone: "danger" as AdminTone },
    { icon: CheckCircle2, label: "Aprovados", value: count((x) => x.status === "aprovado"), detail: "Aprovado" + inc, tone: "success" as AdminTone, mark: true },
    { icon: History, label: "Expirados ou substituídos", value: count((x) => x.status === "expirado" || x.status === "substituido"), detail: "Expirado ou Substituído", tone: "neutral" as AdminTone },
  ];

  const cls = "admin-input h-11 w-full px-3 text-sm";
  const filters = (
    <>
      <select aria-label="Imóvel" value={fl.property} onChange={set("property")} className={cls}><option value="todos">Todos os imóveis</option>{PROPERTIES.map((p) => <option key={p}>{p}</option>)}</select>
      <select aria-label="Tipo de serviço" value={fl.service} onChange={set("service")} className={cls}><option value="todos">Todos os serviços</option>{SERVICES.map((p) => <option key={p}>{p}</option>)}</select>
      <select aria-label="Fornecedor" value={fl.supplier} onChange={set("supplier")} className={cls}><option value="todos">Fornecedor: todos</option>{SUPPLIERS.map((p) => <option key={p}>{p}</option>)}</select>
      <select aria-label="Status" value={fl.status} onChange={set("status")} className={cls}><option value="todos">Todos os status</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      <select aria-label="Validade" value={fl.validity} onChange={set("validity")} className={cls}><option value="todos">Qualquer validade</option><option value="7d">Vencem em 7 dias</option><option value="exp">Expirados</option></select>
      <select aria-label="Período" value={fl.period} onChange={set("period")} className={cls}><option value="todos">Todos os períodos</option><option value="2026-09">09/2026</option><option value="2026-08">08/2026</option></select>
    </>
  );

  const statusLabel = (x: Quote) => (affected(x) ? "Decisão não carregada\u00a0*" : STATUS[x.status].label);

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

      <AdminPageHeader title="Orçamentos" description="Acompanhe propostas de serviços e decisões pendentes." meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>} />

      <label className="admin-input mb-2 flex h-11 min-w-0 items-center gap-2 px-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imóvel, fornecedor ou código" aria-label="Buscar imóvel, fornecedor ou código" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="mb-4 hidden gap-2 md:grid md:grid-cols-3 xl:grid-cols-6">{filters}</div>
      <details className="admin-panel mb-4 md:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-medium text-[var(--admin-text)]">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtros
        </summary>
        <div className="grid gap-2 px-4 pb-4">{filters}</div>
      </details>

      {demo === "parcial" && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>Dados parciais:</strong> a decisão do proprietário não foi atualizada. Fornecedor, valor, validade e anexos permanecem atualizados. Nos orçamentos <strong>Apresentado</strong> e <strong>Aguardando decisão</strong>, o status aparece como “Decisão não carregada”. Os indicadores <strong>Aguardando decisão</strong> e <strong>Aprovados</strong> (marcados com “*”) podem estar incompletos.</p>
        </div>
      )}

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState icon={PlugZap} title="Orçamentos indisponíveis" description="Não foi possível carregar os orçamentos. Nenhum valor é exibido para não parecer que não há propostas. Tente novamente em alguns minutos." />
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
              : list.length === 0 ? <AdminEmptyState title="Nenhum orçamento encontrado" description={hasData ? "Ajuste os filtros ou a busca." : "Não há orçamentos neste período."} />
              : isMobile ? (
                <ul className="divide-y divide-[var(--admin-border)]">{list.map((x) => <MobileCard key={x.code} x={x} statusLabel={statusLabel(x)} onOpen={() => setSel(x)} />)}</ul>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                    <tr className="border-b border-[var(--admin-border)]">
                      <th className="w-[34%] px-4 py-2 font-medium">Orçamento · Serviço</th>
                      <th className="w-[20%] px-2 py-2 font-medium">Rota de pagamento</th>
                      <th className="w-[12%] px-2 py-2 text-right font-medium">Valor</th>
                      <th className="w-[12%] px-2 py-2 font-medium">Validade</th>
                      <th className="w-[22%] px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {list.map((x) => {
                      const f = flagOf(x);
                      return (
                        <tr key={x.code} onClick={() => setSel(x)} tabIndex={0} onKeyDown={(k) => k.key === "Enter" && setSel(x)}
                          className={`cursor-pointer border-l-4 align-top ${f?.strong ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--admin-text)]">{x.code} · v{x.version} · {x.property}</p>
                            <p className="text-xs text-[var(--admin-muted)]">{x.service} · {x.supplier}</p>
                            {f && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--admin-text)]"><f.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text}</p>}
                          </td>
                          <td className="px-2 py-3"><RotaTag /></td>
                          <td className="px-2 py-3 text-right font-semibold tabular-nums">{brl(x.value)}</td>
                          <td className="px-2 py-3 tabular-nums">{x.validUntil}</td>
                          <td className="px-4 py-3">
                            <AdminStatusBadge tone={affected(x) ? "neutral" : STATUS[x.status].tone}>{statusLabel(x)}</AdminStatusBadge>
                            {x.urgent && <p className="mt-1 text-xs font-medium">Prioridade alta</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
          <p className="mt-3 text-xs text-[var(--admin-muted)]">Valores demonstrativos. Orçamento não é despesa, fatura, cobrança da STAYO nem pagamento, e não cria lançamento financeiro. Correções geram nova versão; a anterior permanece consultável.</p>
        </>
      )}

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[88vh] overflow-y-auto" : "w-full overflow-y-auto sm:max-w-md"}>
          {sel && <Detail x={sel} statusLabel={statusLabel(sel)} onOpen={(c) => setSel(Q.find((y) => y.code === c) ?? null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RotaTag() {
  return (
    <span className="inline-flex items-start gap-1 rounded border border-dashed border-[var(--admin-border)] px-1.5 py-0.5 text-xs font-medium text-[var(--admin-text)]">
      <Store className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />Pagamento direto ao fornecedor
    </span>
  );
}

function MobileCard({ x, statusLabel, onOpen }: { x: Quote; statusLabel: string; onOpen: () => void }) {
  const f = flagOf(x);
  return (
    <li>
      <button onClick={onOpen} className={`block w-full border-l-4 px-4 py-3 text-left ${f?.strong ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-text)]">{x.code} · v{x.version} · {x.property}</p>
            <p className="text-xs text-[var(--admin-muted)]">{x.service} · {x.supplier}</p>
          </div>
          <p className="text-sm font-semibold tabular-nums text-[var(--admin-text)]">{brl(x.value)}</p>
        </div>
        <div className="mt-2"><RotaTag /></div>
        {f && <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-[var(--admin-text)]"><f.icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text}</p>}
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div><dt className="text-[var(--admin-muted)]">Status</dt><dd className="font-medium text-[var(--admin-text)]">{statusLabel}{x.urgent ? " · Prioridade alta" : ""}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Validade</dt><dd className="font-medium tabular-nums text-[var(--admin-text)]">{x.validUntil}</dd></div>
        </dl>
      </button>
    </li>
  );
}

function Detail({ x, statusLabel, onOpen }: { x: Quote; statusLabel: string; onOpen: (c: string) => void }) {
  const timeline = [
    { t: "Proposta recebida do fornecedor", n: "Demonstrativo" },
    ...(x.status !== "preparacao" ? [{ t: `Versão ${x.version} apresentada ao proprietário`, n: "Demonstrativo" }] : []),
    ...(x.status === "aprovado" ? [{ t: "Aprovado pelo proprietário", n: "Nenhum lançamento criado" }] : []),
    ...(x.status === "recusado" ? [{ t: "Recusado pelo proprietário", n: "Mantido para histórico" }] : []),
    ...(x.status === "expirado" ? [{ t: "Validade encerrada sem decisão", n: x.validUntil }] : []),
    ...(x.status === "substituido" ? [{ t: `Substituído por ${x.replacedBy}`, n: "Versão preservada, sem alteração" }] : []),
  ];
  const rows: [string, string][] = [
    ["Imóvel", x.property], ["Serviço", x.service], ["Fornecedor", x.supplier], ["Valor", brl(x.value)],
    ["Validade", x.validUntil], ["Rota de pagamento", "Pagamento direto ao fornecedor"], ["Status", statusLabel],
  ];
  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle>{x.code} · v{x.version}</SheetTitle>
        <SheetDescription>Orçamento demonstrativo · somente leitura</SheetDescription>
      </SheetHeader>

      {x.status === "aprovado" && (
        <div className="mt-4 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>A aprovação não cria despesa, fatura ou pagamento automaticamente.</strong></p>
        </div>
      )}
      <div className="mt-4 flex items-start gap-2 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] p-3 text-sm">
        <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>A STAYO apresenta e assessora. Quando aprovado, o proprietário paga diretamente ao fornecedor; não é cobrança da STAYO.</p>
      </div>

      {(x.replaces || x.replacedBy) && (
        <div className="mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium"><History className="h-4 w-4" aria-hidden="true" />
            {x.replaces ? `v${x.version} substitui ${x.replaces} (v1)` : `Substituído por ${x.replacedBy} (v2)`}
          </p>
          <p className="mt-1 text-[var(--admin-muted)]">Valor, escopo, fornecedor e validade da versão anterior não foram alterados.</p>
          <button onClick={() => onOpen((x.replaces ?? x.replacedBy)!)} className="mt-2 min-h-10 text-sm font-medium text-[var(--admin-primary)] underline underline-offset-2">
            {x.replaces ? "Ver versão anterior" : "Ver versão atual"}
          </button>
        </div>
      )}

      <dl className="mt-4 divide-y divide-[var(--admin-border)] text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2"><dt className="text-[var(--admin-muted)]">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>

      <h3 className="mt-5 text-sm font-semibold">Escopo resumido</h3>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">{x.scope}</p>
      <p className="mt-3 flex items-center gap-1.5 text-sm"><Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />Anexos: {x.attachments}</p>

      <h3 className="mt-5 text-sm font-semibold">Linha do tempo (demonstrativa)</h3>
      <ol className="mt-2 space-y-2 border-l border-[var(--admin-border)] pl-3 text-sm">
        {timeline.map((t) => <li key={t.t}><p>{t.t}</p><p className="text-xs text-[var(--admin-muted)]">{t.n}</p></li>)}
      </ol>
      <div className="mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium"><FileText className="h-4 w-4" aria-hidden="true" />Orientação operacional (demonstrativa)</p>
        <p className="mt-1 text-[var(--admin-muted)]">{x.guidance}</p>
      </div>
      <p className="mt-5 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]"><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Sem conta bancária, Pix, cartão, documentos pessoais ou dados de hóspedes nesta visualização.</p>
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
