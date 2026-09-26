import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, FileText, FileWarning, History, Info, Layers, PlugZap, Search, Send, SlidersHorizontal, Store, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatCard, AdminStatusBadge, type AdminTone } from "@/components/admin/AdminPrimitives";
import { FinanceiroPrototypeNav } from "@/components/admin/FinanceiroPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/financeiro/faturas-prototipo")({
  head: () => ({
    meta: [
      { title: "Faturas de serviços (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual de Faturas de serviços do Stayo Admin, com dados demonstrativos." },
      { property: "og:title", content: "Faturas de serviços (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura, sem validade fiscal ou contábil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FaturasPrototype,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PROPERTIES = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12", "Imóvel D · 7"];
const SUPPLIERS = ["Fornecedor demo 1", "Fornecedor demo 2", "Fornecedor demo 3"];
const SERVICES = ["Limpeza pós-obra", "Manutenção", "Enxoval", "Fotos profissionais", "Lavanderia"];

type Doc = "preparacao" | "emitido" | "cancelado" | "substituido";
type Envio = "nao" | "agendado" | "enviado" | "falha";
type Pag = "na" | "apagar" | "pago" | "vencido" | "revisao";
type Rota = "direto" | "stayo";
const DOC: Record<Doc, { label: string; tone: AdminTone }> = {
  preparacao: { label: "Em preparação", tone: "neutral" }, emitido: { label: "Emitido", tone: "info" },
  cancelado: { label: "Cancelado", tone: "neutral" }, substituido: { label: "Substituído", tone: "neutral" },
};
const ENVIO: Record<Envio, { label: string; tone: AdminTone }> = {
  nao: { label: "Não enviado", tone: "neutral" }, agendado: { label: "Agendado", tone: "info" },
  enviado: { label: "Enviado", tone: "success" }, falha: { label: "Falha no envio", tone: "danger" },
};
const PAG: Record<Pag, { label: string; tone: AdminTone }> = {
  na: { label: "Não aplicável", tone: "neutral" }, apagar: { label: "A pagar", tone: "warning" },
  pago: { label: "Pago", tone: "success" }, vencido: { label: "Vencido", tone: "danger" }, revisao: { label: "Em revisão", tone: "warning" },
};
const ROTA: Record<Rota, string> = { direto: "Pagamento direto ao fornecedor", stayo: "Cobrança pela STAYO" };

interface Fatura {
  code: string; version: number; replaces?: string; replacedBy?: string; property: string; service: string; supplier: string;
  resp: "Proprietário" | "Operação"; rota: Rota; items: { label: string; value: number }[]; doc: Doc; envio: Envio; pag: Pag;
  periodKey: string; date: string;
}
const F: Fatura[] = [
  { code: "FS-5012", version: 2, replaces: "FS-5004", property: PROPERTIES[1]!, service: SERVICES[0]!, supplier: SUPPLIERS[0]!, resp: "Proprietário", rota: "stayo", items: [{ label: "Limpeza pós-obra (demonstrativo)", value: 400 }], doc: "emitido", envio: "enviado", pag: "apagar", periodKey: "2026-09", date: "14/09/2026" },
  { code: "FS-5004", version: 1, replacedBy: "FS-5012", property: PROPERTIES[1]!, service: SERVICES[0]!, supplier: SUPPLIERS[0]!, resp: "Proprietário", rota: "stayo", items: [{ label: "Limpeza pós-obra (demonstrativo)", value: 450 }], doc: "substituido", envio: "enviado", pag: "na", periodKey: "2026-09", date: "09/09/2026" },
  { code: "FS-5018", version: 1, property: PROPERTIES[0]!, service: SERVICES[1]!, supplier: SUPPLIERS[1]!, resp: "Proprietário", rota: "direto", items: [{ label: "Troca de sifão e vedação", value: 280 }, { label: "Visita técnica", value: 120 }], doc: "emitido", envio: "falha", pag: "apagar", periodKey: "2026-09", date: "18/09/2026" },
  { code: "FS-5009", version: 1, property: PROPERTIES[2]!, service: SERVICES[4]!, supplier: SUPPLIERS[2]!, resp: "Proprietário", rota: "stayo", items: [{ label: "Lavagem de enxoval · agosto", value: 360 }], doc: "emitido", envio: "enviado", pag: "vencido", periodKey: "2026-09", date: "05/09/2026" },
  { code: "FS-5021", version: 1, property: PROPERTIES[3]!, service: SERVICES[2]!, supplier: SUPPLIERS[2]!, resp: "Proprietário", rota: "direto", items: [{ label: "Kit de enxoval (itens faltantes)", value: 1180 }], doc: "preparacao", envio: "nao", pag: "na", periodKey: "2026-09", date: "22/09/2026" },
  { code: "FS-5016", version: 1, property: PROPERTIES[0]!, service: SERVICES[3]!, supplier: SUPPLIERS[1]!, resp: "Operação", rota: "stayo", items: [{ label: "Ensaio fotográfico", value: 650 }], doc: "emitido", envio: "agendado", pag: "revisao", periodKey: "2026-09", date: "17/09/2026" },
  { code: "FS-4990", version: 1, property: PROPERTIES[3]!, service: SERVICES[1]!, supplier: SUPPLIERS[0]!, resp: "Proprietário", rota: "stayo", items: [{ label: "Reparo de fechadura", value: 210 }], doc: "emitido", envio: "enviado", pag: "pago", periodKey: "2026-08", date: "28/08/2026" },
  { code: "FS-4985", version: 1, property: PROPERTIES[2]!, service: SERVICES[1]!, supplier: SUPPLIERS[1]!, resp: "Proprietário", rota: "direto", items: [{ label: "Revisão do aquecedor", value: 320 }], doc: "cancelado", envio: "nao", pag: "na", periodKey: "2026-08", date: "20/08/2026" },
];

const rank = (f: Fatura) => (f.envio === "falha" ? 0 : f.pag === "vencido" ? 1 : f.pag === "revisao" ? 2 : f.doc === "preparacao" ? 3 : f.pag === "apagar" ? 4 : f.pag === "pago" ? 5 : f.doc === "substituido" ? 6 : 7);
const total = (f: Fatura) => f.items.reduce((s, i) => s + i.value, 0);

function flagOf(f: Fatura) {
  if (f.envio === "falha") return { icon: FileWarning, text: "Falha no envio · documento não chegou", strong: true };
  if (f.pag === "vencido") return { icon: AlertTriangle, text: "Pagamento vencido", strong: true };
  if (f.doc === "substituido") return { icon: History, text: `Substituído por ${f.replacedBy} · preservado para consulta`, strong: false };
  return null;
}

type DemoState = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const stateOptions: { value: DemoState; label: string }[] = [
  { value: "normal", label: "Normal" }, { value: "parcial", label: "Parcial" }, { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" }, { value: "indisponivel", label: "Indisponível" },
];

function FaturasPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<DemoState>("normal");
  const [fl, setFl] = useState({ period: "todos", property: "todos", service: "todos", supplier: "todos", rota: "todos", doc: "todos", envio: "todos", pag: "todos" });
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Fatura | null>(null);
  const set = (k: keyof typeof fl) => (e: React.ChangeEvent<HTMLSelectElement>) => setFl({ ...fl, [k]: e.target.value });

  const hasData = demo === "normal" || demo === "parcial";
  // Parcial: fonte de status de pagamento da cobrança STAYO não respondeu.
  const affected = (f: Fatura) => demo === "parcial" && f.rota === "stayo" && f.doc === "emitido";
  const base = useMemo(() => (hasData ? F : []), [hasData]);
  const scoped = base.filter((f) => (fl.period === "todos" || f.periodKey === fl.period) && (fl.property === "todos" || f.property === fl.property) && (fl.service === "todos" || f.service === fl.service) && (fl.supplier === "todos" || f.supplier === fl.supplier) && (fl.rota === "todos" || f.rota === fl.rota));
  const list = scoped
    .filter((f) => (fl.doc === "todos" || f.doc === fl.doc) && (fl.envio === "todos" || f.envio === fl.envio) && (fl.pag === "todos" || f.pag === fl.pag))
    .filter((f) => !q || `${f.code} ${f.property} ${f.supplier}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => rank(a) - rank(b));

  const count = (fn: (f: Fatura) => boolean) => scoped.filter(fn).length;
  const inc = demo === "parcial" ? " · pode estar incompleto" : "";
  const stats = [
    { icon: FileText, label: "A emitir ou revisar", value: count((f) => f.doc === "preparacao" || f.pag === "revisao"), detail: "Em preparação ou em revisão" + inc, tone: "neutral" as AdminTone, mark: true },
    { icon: Send, label: "Enviadas", value: count((f) => f.envio === "enviado" && f.doc === "emitido"), detail: "Envio concluído", tone: "info" as AdminTone },
    { icon: Wallet, label: "Aguardando pagamento", value: count((f) => f.pag === "apagar" || f.pag === "vencido"), detail: "A pagar ou vencido" + inc, tone: "warning" as AdminTone, mark: true },
    { icon: CheckCircle2, label: "Pagas", value: count((f) => f.pag === "pago"), detail: "Pago" + inc, tone: "success" as AdminTone, mark: true },
    { icon: FileWarning, label: "Com falha de envio ou documento", value: count((f) => f.envio === "falha"), detail: "Falha no envio", tone: "danger" as AdminTone },
  ];

  const cls = "admin-input h-11 w-full px-3 text-sm";
  const filters = (
    <>
      <select aria-label="Período" value={fl.period} onChange={set("period")} className={cls}><option value="todos">Todos os períodos</option><option value="2026-09">09/2026</option><option value="2026-08">08/2026</option></select>
      <select aria-label="Imóvel" value={fl.property} onChange={set("property")} className={cls}><option value="todos">Todos os imóveis</option>{PROPERTIES.map((p) => <option key={p}>{p}</option>)}</select>
      <select aria-label="Tipo de serviço" value={fl.service} onChange={set("service")} className={cls}><option value="todos">Todos os serviços</option>{SERVICES.map((p) => <option key={p}>{p}</option>)}</select>
      <select aria-label="Fornecedor" value={fl.supplier} onChange={set("supplier")} className={cls}><option value="todos">Todos os fornecedores</option>{SUPPLIERS.map((p) => <option key={p}>{p}</option>)}</select>
      <select aria-label="Rota de pagamento" value={fl.rota} onChange={set("rota")} className={cls}><option value="todos">Todas as rotas</option><option value="direto">Direto ao fornecedor</option><option value="stayo">Cobrança pela STAYO</option></select>
      <select aria-label="Documento" value={fl.doc} onChange={set("doc")} className={cls}><option value="todos">Documento: todos</option>{Object.entries(DOC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      <select aria-label="Envio" value={fl.envio} onChange={set("envio")} className={cls}><option value="todos">Envio: todos</option>{Object.entries(ENVIO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      <select aria-label="Pagamento" value={fl.pag} onChange={set("pag")} className={cls}><option value="todos">Pagamento: todos</option>{Object.entries(PAG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
    </>
  );

  const money = (f: Fatura) => (f.doc === "cancelado" ? "—" : brl(total(f)));
  const pagLabel = (f: Fatura) => (affected(f) ? "Não carregado *" : PAG[f.pag].label);

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

      <AdminPageHeader title="Faturas de serviços" description="Acompanhe documentos, envios e pagamentos de serviços." meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>} />

      <label className="admin-input mb-2 flex h-11 min-w-0 items-center gap-2 px-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imóvel, fornecedor ou código" aria-label="Buscar imóvel, fornecedor ou código" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="mb-4 hidden gap-2 md:grid md:grid-cols-4">{filters}</div>
      <details className="admin-panel mb-4 md:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-medium text-[var(--admin-text)]">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtros
        </summary>
        <div className="grid gap-2 px-4 pb-4">{filters}</div>
      </details>

      {demo === "parcial" && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>Dados parciais:</strong> a atualização do status de pagamento não respondeu. Nos documentos emitidos com <strong>Cobrança pela STAYO</strong>, o pagamento aparece como “Não carregado”. Os indicadores <strong>A emitir ou revisar</strong>, <strong>Aguardando pagamento</strong> e <strong>Pagas</strong> (marcados com “*”) podem estar incompletos. Documento e envio estão completos.</p>
        </div>
      )}

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState icon={PlugZap} title="Faturas indisponíveis" description="Não foi possível carregar as faturas de serviços. Nenhum valor é exibido para não parecer que não há documentos. Tente novamente em alguns minutos." />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {stats.map((s) => (
              <AdminStatCard key={s.label} icon={s.icon} label={s.label} tone={hasData ? s.tone : "neutral"}
                value={demo === "carregando" ? <span className="admin-skeleton inline-block h-6 w-12 rounded" />
                  : demo === "vazio" ? <span className="text-base font-medium text-[var(--admin-muted)]">Nenhuma</span>
                  : <span className="text-xl tabular-nums">{s.value}{demo === "parcial" && s.mark ? " *" : ""}</span>}
                detail={demo === "carregando" ? null : s.detail} />
            ))}
          </div>

          <div className="admin-panel">
            {demo === "carregando" ? <SkeletonRows />
              : list.length === 0 ? <AdminEmptyState title="Nenhuma fatura encontrada" description={hasData ? "Ajuste os filtros ou a busca." : "Não há faturas de serviços neste período."} />
              : isMobile ? (
                <ul className="divide-y divide-[var(--admin-border)]">{list.map((f) => <MobileCard key={f.code} f={f} money={money} pagLabel={pagLabel} onOpen={() => setSel(f)} />)}</ul>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                    <tr className="border-b border-[var(--admin-border)]">
                      <th className="w-[30%] px-4 py-2 font-medium">Documento · Serviço</th>
                      <th className="w-[22%] px-2 py-2 font-medium">Rota de pagamento</th>
                      <th className="w-[12%] px-2 py-2 text-right font-medium">Valor</th>
                      <th className="w-[12%] px-2 py-2 font-medium">Documento</th>
                      <th className="w-[12%] px-2 py-2 font-medium">Envio</th>
                      <th className="w-[12%] px-2 py-2 font-medium">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {list.map((f) => {
                      const fl2 = flagOf(f);
                      return (
                        <tr key={f.code} onClick={() => setSel(f)} tabIndex={0} onKeyDown={(k) => k.key === "Enter" && setSel(f)}
                          className={`cursor-pointer border-l-4 align-top ${fl2?.strong ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--admin-text)]">{f.code} · v{f.version} · {f.property}</p>
                            <p className="truncate text-xs text-[var(--admin-muted)]">{f.service} · {f.supplier} · Resp.: {f.resp}</p>
                            {fl2 && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--admin-text)]"><fl2.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{fl2.text}</p>}
                          </td>
                          <td className="px-2 py-3"><RotaTag r={f.rota} /></td>
                          <td className="px-2 py-3 text-right font-semibold tabular-nums">{money(f)}</td>
                          <td className="px-2 py-3"><AdminStatusBadge tone={DOC[f.doc].tone}>{DOC[f.doc].label}</AdminStatusBadge></td>
                          <td className="px-2 py-3"><AdminStatusBadge tone={ENVIO[f.envio].tone}>{ENVIO[f.envio].label}</AdminStatusBadge></td>
                          <td className="px-2 py-3"><AdminStatusBadge tone={affected(f) ? "neutral" : PAG[f.pag].tone}>{pagLabel(f)}</AdminStatusBadge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
          <p className="mt-3 text-xs text-[var(--admin-muted)]">Valores demonstrativos. Documentos emitidos são versões fechadas: correções geram versão substituta, cancelamento ou reemissão, e a anterior permanece consultável. Sem validade fiscal, jurídica ou contábil.</p>
        </>
      )}

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[88vh] overflow-y-auto" : "w-full overflow-y-auto sm:max-w-md"}>
          {sel && <Detail f={sel} pagLabel={pagLabel(sel)} onOpen={(c) => setSel(F.find((x) => x.code === c) ?? null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RotaTag({ r }: { r: Rota }) {
  const Icon = r === "direto" ? Store : Wallet;
  return (
    <span className={`inline-flex items-start gap-1 rounded border px-1.5 py-0.5 text-xs font-medium text-[var(--admin-text)] ${r === "direto" ? "border-dashed border-[var(--admin-border)]" : "border-[var(--admin-primary)]"}`}>
      <Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />{ROTA[r]}
    </span>
  );
}

function MobileCard({ f, money, pagLabel, onOpen }: { f: Fatura; money: (f: Fatura) => string; pagLabel: (f: Fatura) => string; onOpen: () => void }) {
  const fl = flagOf(f);
  return (
    <li>
      <button onClick={onOpen} className={`block w-full border-l-4 px-4 py-3 text-left ${fl?.strong ? "border-l-[var(--admin-danger,#b42318)]" : "border-l-transparent"}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-text)]">{f.code} · v{f.version} · {f.property}</p>
            <p className="text-xs text-[var(--admin-muted)]">{f.service} · {f.supplier}</p>
          </div>
          <p className="text-sm font-semibold tabular-nums text-[var(--admin-text)]">{money(f)}</p>
        </div>
        <div className="mt-2"><RotaTag r={f.rota} /></div>
        {fl && <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-[var(--admin-text)]"><fl.icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />{fl.text}</p>}
        <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div><dt className="text-[var(--admin-muted)]">Documento</dt><dd className="font-medium text-[var(--admin-text)]">{DOC[f.doc].label}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Envio</dt><dd className="font-medium text-[var(--admin-text)]">{ENVIO[f.envio].label}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Pagamento</dt><dd className="font-medium text-[var(--admin-text)]">{pagLabel(f)}</dd></div>
        </dl>
      </button>
    </li>
  );
}

function Detail({ f, pagLabel, onOpen }: { f: Fatura; pagLabel: string; onOpen: (c: string) => void }) {
  const timeline = [
    { t: "Documento preparado", n: f.date },
    ...(f.doc !== "preparacao" && f.doc !== "cancelado" ? [{ t: `Versão ${f.version} emitida`, n: "Demonstrativo" }] : []),
    ...(f.envio === "agendado" ? [{ t: "Envio agendado", n: "Demonstrativo" }] : []),
    ...(f.envio === "enviado" ? [{ t: "Enviado ao responsável", n: "Demonstrativo" }] : []),
    ...(f.envio === "falha" ? [{ t: "Falha no envio", n: "O documento não chegou ao destinatário" }] : []),
    ...(f.doc === "substituido" ? [{ t: `Substituído por ${f.replacedBy}`, n: "Versão preservada, sem alteração" }] : []),
    ...(f.pag === "pago" ? [{ t: "Pagamento registrado", n: "Demonstrativo" }] : []),
    ...(f.doc === "cancelado" ? [{ t: "Documento cancelado", n: "Mantido para histórico" }] : []),
  ];
  const rows: [string, string][] = [
    ["Imóvel", f.property], ["Serviço", f.service], ["Fornecedor", f.supplier], ["Responsabilidade financeira", f.resp],
    ["Rota de pagamento", ROTA[f.rota]], ["Documento", DOC[f.doc].label], ["Envio", ENVIO[f.envio].label], ["Pagamento", pagLabel],
  ];
  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle>{f.code} · v{f.version}</SheetTitle>
        <SheetDescription>Documento demonstrativo · somente leitura</SheetDescription>
      </SheetHeader>

      {f.rota === "direto" && (
        <div className="mt-4 flex items-start gap-2 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><strong>Pagamento direto ao fornecedor.</strong> A STAYO apresenta e intermedeia o serviço; o proprietário paga diretamente ao fornecedor. Este documento não é uma cobrança da STAYO.</p>
        </div>
      )}

      {(f.replaces || f.replacedBy) && (
        <div className="mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium"><History className="h-4 w-4" aria-hidden="true" />
            {f.replaces ? `v${f.version} substitui ${f.replaces} (v1)` : `Substituído por ${f.replacedBy} (v2)`}
          </p>
          <p className="mt-1 text-[var(--admin-muted)]">O documento anterior não foi alterado e continua consultável.</p>
          <button onClick={() => onOpen((f.replaces ?? f.replacedBy)!)} className="mt-2 min-h-10 text-sm font-medium text-[var(--admin-primary)] underline underline-offset-2">
            {f.replaces ? "Ver versão anterior" : "Ver versão atual"}
          </button>
        </div>
      )}

      <dl className="mt-4 divide-y divide-[var(--admin-border)] text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2"><dt className="text-[var(--admin-muted)]">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>

      <h3 className="mt-5 text-sm font-semibold">Itens (demonstrativo)</h3>
      <dl className="mt-2 divide-y divide-[var(--admin-border)] text-sm">
        {f.items.map((i) => <div key={i.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2"><dt>{i.label}</dt><dd className="tabular-nums">{brl(i.value)}</dd></div>)}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5"><dt className="font-semibold">Total</dt><dd className="text-base font-semibold tabular-nums">{f.doc === "cancelado" ? "—" : brl(total(f))}</dd></div>
      </dl>

      <h3 className="mt-5 text-sm font-semibold">Linha do tempo (demonstrativa)</h3>
      <ol className="mt-2 space-y-2 border-l border-[var(--admin-border)] pl-3 text-sm">
        {timeline.map((x) => <li key={x.t}><p>{x.t}</p><p className="text-xs text-[var(--admin-muted)]">{x.n}</p></li>)}
      </ol>
      <p className="mt-5 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]"><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Sem conta bancária, Pix, cartão, documentos pessoais ou dados de hóspedes nesta visualização.</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]"><Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Sem validade fiscal, jurídica ou contábil.</p>
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
