import { MonthPicker } from "@/components/ui/month-picker";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownCircle,
  CalendarClock,
  ChevronRight,
  Clock,
  FileText,
  PlugZap,
  Receipt,
  SlidersHorizontal,
  Wallet,
  Send,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { FinanceiroPrototypeNav } from "@/components/admin/FinanceiroPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";

export const Route = createFileRoute("/financeiro/prototipo")({
  head: () => ({
    meta: [
      { title: "Financeiro · Visão geral (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual da visão geral financeira do Stayo Admin, com dados demonstrativos." },
      { property: "og:title", content: "Financeiro · Visão geral (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura, dados demonstrativos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceiroPrototype,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Priority = "alta" | "media" | "baixa";
const PRIORITY: Record<Priority, { label: string; tone: AdminTone; rank: number }> = {
  alta: { label: "Alta", tone: "danger", rank: 0 },
  media: { label: "Média", tone: "warning", rank: 1 },
  baixa: { label: "Baixa", tone: "neutral", rank: 2 },
};
const PROPERTIES = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12"];

interface Attention { id: string; type: string; property: string; due: string; amount: number; status: string; priority: Priority; source: "receber" | "despesa" | "repasse" | "fechamento" | "orcamento" }
const ATTENTION: Attention[] = [
  { id: "1", type: "Recebimento vencido", property: PROPERTIES[1]!, due: "Venceu há 3 dias", amount: 1840, status: "Vencido", priority: "alta", source: "receber" },
  { id: "2", type: "Repasse próximo do vencimento", property: PROPERTIES[0]!, due: "Vence em 2 dias", amount: 4210, status: "A programar", priority: "alta", source: "repasse" },
  { id: "3", type: "Despesa aguardando aprovação", property: PROPERTIES[2]!, due: "Prazo 30/09", amount: 620, status: "Aguardando aprovação", priority: "media", source: "despesa" },
  { id: "4", type: "Fechamento aguardando revisão", property: PROPERTIES[0]!, due: "Prazo 05/10", amount: 7980, status: "Em revisão", priority: "media", source: "fechamento" },
  { id: "5", type: "Orçamento aguardando decisão", property: PROPERTIES[1]!, due: "Sem prazo definido", amount: 950, status: "Aguardando proprietário", priority: "baixa", source: "orcamento" },
];

type DemoState = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const stateOptions: { value: DemoState; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "parcial", label: "Parcial" },
  { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" },
  { value: "indisponivel", label: "Indisponível" },
];

function FinanceiroPrototype() {
  const [demo, setDemo] = useState<DemoState>("normal");
  const [period, setPeriod] = useState("2026-09");
  const [property, setProperty] = useState("todos");
  const [basis, setBasis] = useState<"competencia" | "caixa">("competencia");

  const factor = property === "todos" ? 1 : 0.34;
  const attention = useMemo(
    () =>
      ATTENTION.filter((a) => property === "todos" || a.property === property)
        .filter((a) => !(demo === "parcial" && a.source === "despesa"))
        .sort((x, y) => PRIORITY[x.priority].rank - PRIORITY[y.priority].rank),
    [property, demo],
  );

  const hasData = demo === "normal" || demo === "parcial";
  const partialAffected = new Set(["Despesas pendentes"]);
  const v = {
    bruta: 48600 * factor,
    recebido: 31250 * factor,
    receber: 13550 * factor,
    atraso: 3800 * factor,
    despesas: 4920 * factor,
    repasses: 22340 * factor,
  };
  const stats = [
    { icon: TrendingUp, label: "Receita bruta do período", value: v.bruta, nature: "Previsto", tone: "info" as AdminTone },
    { icon: Wallet, label: "Recebido no período", value: v.recebido, nature: "Recebido", tone: "success" as AdminTone },
    { icon: Clock, label: "A receber", value: v.receber, nature: "Previsto", tone: "neutral" as AdminTone },
    { icon: AlertTriangle, label: "Em atraso", value: v.atraso, nature: "Vencido", tone: "danger" as AdminTone },
    { icon: Receipt, label: "Despesas pendentes", value: v.despesas, nature: "A pagar", tone: "warning" as AdminTone },
    { icon: Send, label: "Repasses a programar", value: v.repasses, nature: "Estimado", tone: "neutral" as AdminTone },
  ];

  // Fluxo: proporções da receita bruta; só a receita de gestão tem valor próprio (não aparece em outro lugar).
  const gestao = v.bruta * 0.2;
  const flow = [
    { label: "Receita bruta", pct: 100, note: "Base do período" },
    { label: "Valores recebidos", pct: 64, note: "Recebido" },
    { label: "Valores a receber", pct: 28, note: "Previsto" },
    { label: "Despesas", pct: 10, note: demo === "parcial" ? "Pode estar incompleto" : "Pendentes + pagas" },
    { label: "Repasses", pct: 46, note: "Estimado" },
    { label: "Receita de gestão estimada", pct: 20, note: brl(gestao), strong: true },
  ];

  const fronts = [
    { icon: ArrowDownCircle, label: "Contas a receber", count: 4, priority: "alta" as Priority },
    { icon: Receipt, label: "Despesas", count: demo === "parcial" ? null : 3, priority: "media" as Priority },
    { icon: Send, label: "Repasses", count: 6, priority: "alta" as Priority },
    { icon: CalendarClock, label: "Fechamentos", count: 2, priority: "media" as Priority },
    { icon: FileText, label: "Serviços e orçamentos", count: 1, priority: "baixa" as Priority },
  ];

  const filters = (
    <>
      <MonthPicker aria-label="Período" value={period} onValueChange={setPeriod} className="admin-input h-11 w-full px-3 text-sm sm:w-auto" required />
      <select aria-label="Filtrar por imóvel" value={property} onChange={(e) => setProperty(e.target.value)} className="admin-input h-11 w-full px-3 text-sm sm:w-auto">
        <option value="todos">Todos os imóveis</option>
        {PROPERTIES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select aria-label="Base do período" value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)} className="admin-input h-11 w-full px-3 text-sm sm:w-auto">
        <option value="competencia">Base: Competência</option>
        <option value="caixa">Base: Caixa</option>
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
        title="Financeiro"
        description="Acompanhe recebimentos, pendências, despesas e repasses."
        meta={
          <span className="flex flex-wrap items-center gap-2 text-xs">
            <AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>
            <span>Base {basis === "competencia" ? "competência" : "caixa"} (demonstrativa)</span>
          </span>
        }
        actions={<div className="hidden flex-wrap gap-2 sm:flex">{filters}</div>}
      />

      <details className="admin-panel mb-4 sm:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-medium text-[var(--admin-text)]">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtros
          <span className="ml-auto text-xs font-normal text-[var(--admin-muted)]">{property === "todos" ? "Todos os imóveis" : property}</span>
        </summary>
        <div className="grid gap-2 px-4 pb-4">{filters}</div>
      </details>

      {demo === "parcial" && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>Dados parciais:</strong> as despesas deste período não foram totalmente carregadas. Podem estar incompletos: <strong>Despesas pendentes</strong>, a linha <strong>Despesas</strong> do fluxo e a frente <strong>Despesas</strong>. Os demais indicadores não são afetados.</p>
        </div>
      )}

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState icon={PlugZap} title="Dados financeiros indisponíveis" description="Não foi possível carregar as informações financeiras. Nenhum valor é exibido para não parecer saldo real. Tente novamente em alguns minutos." />
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {stats.map((s) => {
              const affected = demo === "parcial" && partialAffected.has(s.label);
              return (
                <AdminStatCard
                  key={s.label}
                  icon={s.icon}
                  label={s.label}
                  tone={hasData ? s.tone : "neutral"}
                  value={
                    demo === "carregando" ? <span className="admin-skeleton inline-block h-6 w-20 rounded" />
                    : demo === "vazio" ? <span className="text-base font-medium text-[var(--admin-muted)]">Sem lançamentos</span>
                    : <span className="text-lg tabular-nums sm:text-xl">{brl(s.value)}{affected ? " *" : ""}</span>
                  }
                  detail={demo === "carregando" ? null : affected ? `${s.nature} · pode estar incompleto` : s.nature}
                />
              );
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <AdminSection title="O que exige atenção financeira" description="Ordenado por prioridade.">
              <div className="admin-panel">
                {demo === "carregando" ? <SkeletonRows /> : !hasData || attention.length === 0 ? (
                  <AdminEmptyState title="Nada exige atenção financeira" description="Pendências aparecem aqui assim que surgirem no período." />
                ) : (
                  <ul className="divide-y divide-[var(--admin-border)]">
                    {attention.map((a) => (
                      <li key={a.id} className={`flex items-start gap-3 px-4 py-3 ${a.priority === "alta" ? "border-l-4 border-l-[var(--admin-danger,#b42318)]" : "border-l-4 border-l-transparent"}`}>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--admin-text)]">
                            {a.priority === "alta" && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                            {a.type}
                          </p>
                          <p className="text-xs text-[var(--admin-muted)]">{a.property} · {a.due}</p>
                          <p className="mt-0.5 text-xs text-[var(--admin-muted)]">Status: {a.status}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-semibold tabular-nums text-[var(--admin-text)]">{brl(a.amount * (property === "todos" ? 1 : 1))}</span>
                          <AdminStatusBadge tone={PRIORITY[a.priority].tone}>{PRIORITY[a.priority].label}</AdminStatusBadge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </AdminSection>

            <div className="space-y-5">
              <AdminSection title="Fluxo do período" description="Proporção em relação à receita bruta.">
                <div className="admin-panel px-4 py-4">
                  {demo === "carregando" ? <SkeletonRows /> : !hasData ? (
                    <AdminEmptyState title="Sem movimentação no período" description="Escolha outro período ou imóvel." />
                  ) : (
                    <>
                      <ol className="space-y-3">
                        {flow.map((f) => (
                          <li key={f.label}>
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className={f.strong ? "font-semibold text-[var(--admin-text)]" : "text-[var(--admin-text)]"}>{f.label}</span>
                              <span className="shrink-0 text-xs tabular-nums text-[var(--admin-muted)]">{f.pct}% · {f.note}</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-[var(--admin-border)]">
                              <div className="h-2 rounded-full bg-[var(--admin-primary)]" style={{ width: `${f.pct}%`, opacity: f.strong ? 1 : 0.6 }} />
                            </div>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-4 text-xs text-[var(--admin-muted)]">Visualização demonstrativa. Não substitui conciliação bancária nem representa saldo contábil.</p>
                    </>
                  )}
                </div>
              </AdminSection>

              <AdminSection title="Pendências por frente">
                <div className="admin-panel">
                  {demo === "carregando" ? <SkeletonRows /> : (
                    <ul className="divide-y divide-[var(--admin-border)]">
                      {fronts.map((f) => (
                        <li key={f.label} aria-disabled="true" title="Aprofundamento em fase futura" className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">
                          <f.icon className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
                          <span className="min-w-0 flex-1 text-[var(--admin-text)]">{f.label}</span>
                          <span className="shrink-0 text-xs text-[var(--admin-muted)]">
                            {!hasData ? "0 pendências" : f.count === null ? "Incompleto" : `${f.count} pendência${f.count === 1 ? "" : "s"}`}
                          </span>
                          {hasData && f.count !== null && <AdminStatusBadge tone={PRIORITY[f.priority].tone}>{PRIORITY[f.priority].label}</AdminStatusBadge>}
                          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </AdminSection>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-[var(--admin-border)]" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <div className="flex-1 space-y-2">
            <div className="admin-skeleton h-3.5 w-2/3 rounded" />
            <div className="admin-skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
