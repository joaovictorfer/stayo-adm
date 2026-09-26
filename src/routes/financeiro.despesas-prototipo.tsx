import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, FileCheck2, Hourglass, PlugZap, Search, SlidersHorizontal, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge, type AdminTone } from "@/components/admin/AdminPrimitives";
import { FinanceiroPrototypeNav } from "@/components/admin/FinanceiroPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/financeiro/despesas-prototipo")({
  head: () => ({
    meta: [
      { title: "Despesas (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual de Despesas do Stayo Admin, com dados demonstrativos." },
      { property: "og:title", content: "Despesas (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura, dados demonstrativos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DespesasPrototype,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PROPERTIES = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12"];

type Category = "limpeza" | "manutencao" | "compras" | "recorrentes" | "outras";
const CATEGORY: Record<Category, string> = { limpeza: "Limpeza", manutencao: "Manutenção", compras: "Compras", recorrentes: "Serviços recorrentes", outras: "Outras despesas" };
type Approval = "aguardando" | "aprovada" | "rejeitada";
const APPROVAL: Record<Approval, { label: string; tone: AdminTone }> = {
  aguardando: { label: "Aguardando aprovação", tone: "warning" },
  aprovada: { label: "Aprovada", tone: "success" },
  rejeitada: { label: "Rejeitada", tone: "neutral" },
};
type Payment = "apagar" | "vencida" | "programada" | "paga";
const PAYMENT: Record<Payment, { label: string; tone: AdminTone }> = {
  apagar: { label: "A pagar", tone: "info" },
  vencida: { label: "Vencida", tone: "danger" },
  programada: { label: "Programada", tone: "neutral" },
  paga: { label: "Paga", tone: "success" },
};
type Resp = "proprietario" | "operacao";
const RESP: Record<Resp, string> = { proprietario: "Proprietário", operacao: "Operação" };

interface Expense { code: string; property: string; category: Category; supplier: string; competence: string; due: string; dueDays: number; amount: number; resp: Resp; approval: Approval; payment: Payment; docs: number; guidance: string }
const EXPENSES: Expense[] = [
  { code: "DP-2081", property: PROPERTIES[1]!, category: "manutencao", supplier: "Fornecedor demo Hidráulica", competence: "09/2026", due: "22/09/2026", dueDays: -4, amount: 620, resp: "proprietario", approval: "aprovada", payment: "vencida", docs: 2, guidance: "Despesa aprovada e vencida. Priorizar a programação do pagamento e registrar no fechamento do proprietário." },
  { code: "DP-2086", property: PROPERTIES[2]!, category: "compras", supplier: "Fornecedor demo Enxoval", competence: "09/2026", due: "30/09/2026", dueDays: 4, amount: 1180, resp: "proprietario", approval: "aguardando", payment: "apagar", docs: 1, guidance: "Aguardando aprovação do proprietário antes de qualquer pagamento." },
  { code: "DP-2089", property: PROPERTIES[0]!, category: "limpeza", supplier: "Equipe demo Limpeza", competence: "09/2026", due: "27/09/2026", dueDays: 1, amount: 340, resp: "operacao", approval: "aguardando", payment: "apagar", docs: 0, guidance: "Vence amanhã e ainda sem aprovação. Confirmar a execução do serviço antes de aprovar." },
  { code: "DP-2090", property: PROPERTIES[1]!, category: "recorrentes", supplier: "Fornecedor demo Internet", competence: "09/2026", due: "01/10/2026", dueDays: 5, amount: 129.9, resp: "proprietario", approval: "aprovada", payment: "programada", docs: 1, guidance: "Pagamento recorrente programado. Conferir se o valor mudou em relação ao mês anterior." },
  { code: "DP-2093", property: PROPERTIES[0]!, category: "manutencao", supplier: "Fornecedor demo Elétrica", competence: "10/2026", due: "10/10/2026", dueDays: 14, amount: 480, resp: "operacao", approval: "aprovada", payment: "apagar", docs: 1, guidance: "Aprovada, sem urgência. Programar junto aos demais pagamentos da semana." },
  { code: "DP-2072", property: PROPERTIES[2]!, category: "limpeza", supplier: "Equipe demo Limpeza", competence: "09/2026", due: "15/09/2026", dueDays: -11, amount: 340, resp: "operacao", approval: "aprovada", payment: "paga", docs: 2, guidance: "Paga no período. Nenhuma ação pendente." },
  { code: "DP-2075", property: PROPERTIES[1]!, category: "outras", supplier: "Fornecedor demo Chaveiro", competence: "09/2026", due: "18/09/2026", dueDays: -8, amount: 150, resp: "proprietario", approval: "aprovada", payment: "paga", docs: 1, guidance: "Paga no período. Nenhuma ação pendente." },
  { code: "DP-2078", property: PROPERTIES[0]!, category: "recorrentes", supplier: "Fornecedor demo Condomínio", competence: "09/2026", due: "10/09/2026", dueDays: -16, amount: 890, resp: "proprietario", approval: "aprovada", payment: "paga", docs: 1, guidance: "Paga no período. Nenhuma ação pendente." },
];
const SUPPLIERS = [...new Set(EXPENSES.map((e) => e.supplier))];
const open_ = (e: Expense) => e.payment !== "paga" && e.approval !== "rejeitada";
const soon = (e: Expense) => open_(e) && e.payment !== "vencida" && e.dueDays >= 0 && e.dueDays <= 7;
const rank = (e: Expense) => (e.payment === "vencida" ? 0 : e.approval === "aguardando" && soon(e) ? 1 : e.approval === "aguardando" ? 2 : soon(e) ? 3 : e.payment === "paga" ? 6 : 4) * 100 + e.dueDays;

function flagOf(e: Expense) {
  if (e.payment === "vencida") return { icon: AlertTriangle, text: `Vencida há ${-e.dueDays} dias`, priority: { label: "Alta", tone: "danger" as AdminTone } };
  if (e.approval === "aguardando" && soon(e)) return { icon: Hourglass, text: `Aprovação pendente · vence em ${e.dueDays} ${e.dueDays === 1 ? "dia" : "dias"}`, priority: { label: "Alta", tone: "danger" as AdminTone } };
  if (e.approval === "aguardando") return { icon: Hourglass, text: "Aprovação pendente", priority: { label: "Média", tone: "warning" as AdminTone } };
  if (soon(e)) return { icon: CalendarClock, text: `Vence em ${e.dueDays} dias`, priority: { label: "Média", tone: "warning" as AdminTone } };
  return null;
}

type DemoState = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const stateOptions: { value: DemoState; label: string }[] = [
  { value: "normal", label: "Normal" }, { value: "parcial", label: "Parcial" }, { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" }, { value: "indisponivel", label: "Indisponível" },
];

function DespesasPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<DemoState>("normal");
  const [period, setPeriod] = useState("2026-09");
  const [property, setProperty] = useState("todos");
  const [category, setCategory] = useState<"todos" | Category>("todos");
  const [supplier, setSupplier] = useState("todos");
  const [resp, setResp] = useState<"todos" | Resp>("todos");
  const [approval, setApproval] = useState<"todos" | Approval>("todos");
  const [payment, setPayment] = useState<"todos" | Payment>("todos");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Expense | null>(null);

  const hasData = demo === "normal" || demo === "parcial";
  const base = useMemo(() => (hasData ? EXPENSES.filter((e) => !(demo === "parcial" && e.category === "recorrentes")) : []), [demo, hasData]);
  const scoped = base.filter((e) => (property === "todos" || e.property === property) && (category === "todos" || e.category === category) && (supplier === "todos" || e.supplier === supplier) && (resp === "todos" || e.resp === resp));
  const list = scoped
    .filter((e) => (approval === "todos" || e.approval === approval) && (payment === "todos" || e.payment === payment))
    .filter((e) => !q || `${e.code} ${e.property} ${e.supplier}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => rank(a) - rank(b));

  const sum = (f: (e: Expense) => boolean) => scoped.filter(f).reduce((s, e) => s + e.amount, 0);
  const inc = demo === "parcial" ? " · pode estar incompleto" : "";
  const stats = [
    { icon: Wallet, label: "A pagar", value: sum(open_), nature: "A pagar" + inc, tone: "info" as AdminTone, mark: true },
    { icon: AlertTriangle, label: "Vencidas", value: sum((e) => e.payment === "vencida"), nature: "Vencida", tone: "danger" as AdminTone },
    { icon: CalendarClock, label: "Vencem nos próximos 7 dias", value: sum(soon), nature: "A pagar" + inc, tone: "warning" as AdminTone, mark: true },
    { icon: Hourglass, label: "Aguardando aprovação", value: sum((e) => e.approval === "aguardando"), nature: "Aprovação pendente", tone: "warning" as AdminTone },
    { icon: CheckCircle2, label: "Pagas no período", value: sum((e) => e.payment === "paga"), nature: "Paga" + inc, tone: "success" as AdminTone, mark: true },
  ];

  const cls = "admin-input h-11 w-full px-3 text-sm";
  const filters = (
    <>
      <input type="month" aria-label="Período" value={period} onChange={(e) => setPeriod(e.target.value)} className={cls} />
      <select aria-label="Imóvel" value={property} onChange={(e) => setProperty(e.target.value)} className={cls}>
        <option value="todos">Todos os imóveis</option>{PROPERTIES.map((p) => <option key={p}>{p}</option>)}
      </select>
      <select aria-label="Categoria" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={`${cls} md:hidden`}>
        <option value="todos">Todas as categorias</option>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select aria-label="Fornecedor" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={cls}>
        <option value="todos">Todos os fornecedores</option>{SUPPLIERS.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select aria-label="Responsabilidade" value={resp} onChange={(e) => setResp(e.target.value as typeof resp)} className={cls}>
        <option value="todos">Proprietário e Operação</option><option value="proprietario">Proprietário</option><option value="operacao">Operação</option>
      </select>
      <select aria-label="Aprovação" value={approval} onChange={(e) => setApproval(e.target.value as typeof approval)} className={cls}>
        <option value="todos">Qualquer aprovação</option>{Object.entries(APPROVAL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <select aria-label="Pagamento" value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)} className={cls}>
        <option value="todos">Qualquer pagamento</option>{Object.entries(PAYMENT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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

      <AdminPageHeader title="Despesas" description="Acompanhe aprovações, vencimentos e pagamentos operacionais." meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>} />

      <label className="admin-input mb-2 flex h-11 min-w-0 items-center gap-2 px-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imóvel, fornecedor ou código" aria-label="Buscar imóvel, fornecedor ou código" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="mb-4 hidden gap-2 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filters}</div>
      <details className="admin-panel mb-4 md:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-medium text-[var(--admin-text)]">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtros
          <span className="ml-auto truncate text-xs font-normal text-[var(--admin-muted)]">{category === "todos" ? "Todas as categorias" : CATEGORY[category]}</span>
        </summary>
        <div className="grid gap-2 px-4 pb-4">{filters}</div>
      </details>

      {demo === "parcial" && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>Dados parciais:</strong> a fonte de contas recorrentes (internet, condomínio, energia) não respondeu. A categoria <strong>Serviços recorrentes</strong> está sem lançamentos na lista. Podem estar incompletos: <strong>A pagar</strong>, <strong>Vencem nos próximos 7 dias</strong> e <strong>Pagas no período</strong>. As demais categorias estão completas.</p>
        </div>
      )}

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState icon={PlugZap} title="Despesas indisponíveis" description="Não foi possível carregar as despesas. Nenhum valor é exibido para não parecer que não há nada a pagar. Tente novamente em alguns minutos." />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {stats.map((s) => (
              <AdminStatCard key={s.label} icon={s.icon} label={s.label} tone={hasData ? s.tone : "neutral"}
                value={demo === "carregando" ? <span className="admin-skeleton inline-block h-6 w-20 rounded" />
                  : demo === "vazio" ? <span className="text-base font-medium text-[var(--admin-muted)]">Sem lançamentos</span>
                  : <span className="text-lg tabular-nums sm:text-xl">{brl(s.value)}{demo === "parcial" && s.mark ? " *" : ""}</span>}
                detail={demo === "carregando" ? null : s.nature} />
            ))}
          </div>

          {/* Categorias: botões que quebram linha no desktop; no celular ficam no painel de filtros */}
          <div className="mb-3 hidden flex-wrap gap-2 md:flex" role="group" aria-label="Categoria">
            {(["todos", ...Object.keys(CATEGORY)] as ("todos" | Category)[]).map((c) => {
              const active = category === c;
              const missing = demo === "parcial" && c === "recorrentes";
              return (
                <button key={c} onClick={() => setCategory(c)} aria-pressed={active}
                  className={`min-h-10 rounded-full border px-3 text-sm ${active ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary,#fff)]" : "border-[var(--admin-border)] text-[var(--admin-text)]"}`}>
                  {c === "todos" ? "Todas" : CATEGORY[c]}{missing ? " · incompleta" : ""}
                </button>
              );
            })}
          </div>

          <div className="admin-panel">
            {demo === "carregando" ? <SkeletonRows />
              : list.length === 0 ? <AdminEmptyState title="Nenhuma despesa encontrada" description={hasData ? (demo === "parcial" && category === "recorrentes" ? "Esta categoria está temporariamente indisponível — não significa que não há despesas." : "Ajuste os filtros ou a busca.") : "Não há despesas neste período."} />
              : isMobile ? (
                <ul className="divide-y divide-[var(--admin-border)]">{list.map((e) => <MobileCard key={e.code} e={e} onOpen={() => setSel(e)} />)}</ul>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                    <tr className="border-b border-[var(--admin-border)]">
                      <th className="w-[27%] px-4 py-2 font-medium">Despesa</th>
                      <th className="w-[20%] px-2 py-2 font-medium">Fornecedor</th>
                      <th className="w-[11%] px-2 py-2 font-medium">Vencimento</th>
                      <th className="w-[11%] px-2 py-2 text-right font-medium">Valor</th>
                      <th className="w-[31%] px-4 py-2 font-medium">Aprovação · Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {list.map((e) => {
                      const f = flagOf(e);
                      return (
                        <tr key={e.code} onClick={() => setSel(e)} tabIndex={0} onKeyDown={(k) => k.key === "Enter" && setSel(e)}
                          className={`cursor-pointer border-l-4 ${f?.priority.tone === "danger" ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--admin-text)]">{e.code} · {CATEGORY[e.category]}</p>
                            <p className="text-xs text-[var(--admin-muted)]">{e.property} · Responsável: {RESP[e.resp]}</p>
                          </td>
                          <td className="break-words px-2 py-3 text-[var(--admin-text)]">{e.supplier}</td>
                          <td className="px-2 py-3 tabular-nums">{e.due}</td>
                          <td className="px-2 py-3 text-right font-semibold tabular-nums">{brl(e.amount)}</td>
                          <td className="px-4 py-3">
                            <StatusPair e={e} />
                            {f && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--admin-text)]"><f.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text} · Prioridade {f.priority.label.toLowerCase()}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
          <p className="mt-3 text-xs text-[var(--admin-muted)]">Valores demonstrativos. Não representam pagamento confirmado, saldo bancário nem escrituração contábil.</p>
        </>
      )}

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[88vh] overflow-y-auto" : "w-full overflow-y-auto sm:max-w-md"}>
          {sel && <Detail e={sel} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusPair({ e }: { e: Expense }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="sr-only">Aprovação:</span><AdminStatusBadge tone={APPROVAL[e.approval].tone}>{APPROVAL[e.approval].label}</AdminStatusBadge>
      <span className="sr-only">Pagamento:</span><AdminStatusBadge tone={PAYMENT[e.payment].tone}>{PAYMENT[e.payment].label}</AdminStatusBadge>
    </div>
  );
}

function MobileCard({ e, onOpen }: { e: Expense; onOpen: () => void }) {
  const f = flagOf(e);
  return (
    <li>
      <button onClick={onOpen} className={`block w-full border-l-4 px-4 py-3 text-left ${f?.priority.tone === "danger" ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-text)]">{e.code} · {CATEGORY[e.category]}</p>
            <p className="text-xs text-[var(--admin-muted)]">{e.property}</p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-[var(--admin-text)]">{brl(e.amount)}</span>
        </div>
        {f && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[var(--admin-text)]"><f.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{f.text} · Prioridade {f.priority.label.toLowerCase()}</p>}
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div><dt className="text-[var(--admin-muted)]">Aprovação</dt><dd className="mt-0.5"><AdminStatusBadge tone={APPROVAL[e.approval].tone}>{APPROVAL[e.approval].label}</AdminStatusBadge></dd></div>
          <div><dt className="text-[var(--admin-muted)]">Pagamento</dt><dd className="mt-0.5"><AdminStatusBadge tone={PAYMENT[e.payment].tone}>{PAYMENT[e.payment].label}</AdminStatusBadge></dd></div>
        </dl>
        <p className="mt-2 text-xs text-[var(--admin-muted)]">{e.supplier} · Vence {e.due} · Responsável: {RESP[e.resp]}</p>
      </button>
    </li>
  );
}

function Detail({ e }: { e: Expense }) {
  const timeline = [
    { t: "Despesa lançada", n: `Competência ${e.competence}` },
    ...(e.approval === "aguardando" ? [{ t: "Enviada para aprovação", n: e.resp === "proprietario" ? "Aguardando proprietário" : "Aguardando operação" }] : [{ t: "Aprovada", n: RESP[e.resp] }]),
    ...(e.payment === "programada" ? [{ t: "Pagamento programado", n: e.due }] : []),
    ...(e.payment === "vencida" ? [{ t: "Vencimento ultrapassado", n: e.due }] : []),
    ...(e.payment === "paga" ? [{ t: "Pagamento registrado", n: brl(e.amount) }] : []),
  ];
  const rows: [string, React.ReactNode][] = [
    ["Imóvel", e.property], ["Categoria", CATEGORY[e.category]], ["Fornecedor", e.supplier], ["Competência", e.competence],
    ["Vencimento", e.due], ["Valor", brl(e.amount)], ["Responsabilidade", RESP[e.resp]],
    ["Aprovação", APPROVAL[e.approval].label], ["Pagamento", PAYMENT[e.payment].label],
    ["Documentos / evidências", e.docs ? `${e.docs} (demonstrativo)` : "Nenhum (demonstrativo)"],
  ];
  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle>{e.code}</SheetTitle>
        <SheetDescription>Despesa demonstrativa · somente leitura</SheetDescription>
      </SheetHeader>
      <dl className="mt-4 divide-y divide-[var(--admin-border)] text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2">
            <dt className="text-[var(--admin-muted)]">{k}</dt><dd className="text-right font-medium text-[var(--admin-text)]">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 text-sm font-semibold">Linha do tempo (demonstrativa)</h3>
      <ol className="mt-2 space-y-2 border-l border-[var(--admin-border)] pl-3 text-sm">
        {timeline.map((x) => <li key={x.t}><p className="text-[var(--admin-text)]">{x.t}</p><p className="text-xs text-[var(--admin-muted)]">{x.n}</p></li>)}
      </ol>
      <div className="mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium"><FileCheck2 className="h-4 w-4" aria-hidden="true" />Orientação financeira (demonstrativa)</p>
        <p className="mt-1 text-[var(--admin-muted)]">{e.guidance}</p>
      </div>
      <p className="mt-5 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]"><Clock className="h-3.5 w-3.5" aria-hidden="true" />Sem dados bancários, Pix ou documentos do fornecedor nesta visualização.</p>
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
