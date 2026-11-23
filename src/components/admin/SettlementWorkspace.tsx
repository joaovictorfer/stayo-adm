import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, FileCheck2, RefreshCw, Search, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminEmptyState, AdminStatusBadge } from "./AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { settlementsListQuery } from "@/lib/api/queries";
import { formatMoney } from "@/lib/format";
import type { Settlement } from "@/types/core";

const date = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "Não informado";

/** Existing Core settlements only; presentation never materializes or pays a service. */
export function SettlementWorkspace() {
  const query = useQuery(settlementsListQuery());
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Settlement | null>(null);
  const data = query.data?.data ?? [];
  const providers = useMemo(() => Array.from(new Map(data.map((s) => [s.providerId, s.providerName ?? "Prestador não informado"]))).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [query.data]);
  const rows = data.filter((s) => (!provider || s.providerId === provider) && (!status || s.status === status) && (!from || s.periodEnd >= from) && (!to || s.periodStart <= to) && `${s.code} ${s.providerName ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const money = (value: number) => formatMoney(value) ?? "Não informado";
  const field = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const label = "grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground";

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Fechamentos da equipe</h2><p className="mt-1 text-sm text-muted-foreground">Serviços por prestador e período</p></div>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={`size-4 ${query.isFetching ? "motion-safe:animate-spin" : ""}`} />Atualizar lista</Button>
    </div>
    <div className="grid gap-3 border-y border-border py-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className={label}>Início do período<Input type="date" aria-label="Início do período" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className={label}>Fim do período<Input type="date" aria-label="Fim do período" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <label className={label}>Prestador<select className={field} value={provider} onChange={(e) => setProvider(e.target.value)}><option value="">Todos os prestadores</option>{providers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className={label}>Situação<select className={field} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas as situações</option><option value="aberto">Em aberto</option><option value="pago">Pago</option></select></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{rows.length} fechamentos <span className="mx-2">·</span><strong className="text-foreground">{query.isPending || query.isError ? "—" : money(rows.reduce((sum, s) => sum + s.total, 0))}</strong></p>
      <label className="flex w-full items-center gap-2 sm:max-w-xs"><Search className="size-4 shrink-0 text-muted-foreground" /><Input aria-label="Buscar fechamento" placeholder="Referência ou prestador" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
    </div>
    {query.isPending ? <p role="status" className="py-10 text-center text-muted-foreground">Carregando fechamentos…</p> : query.isError ? <div role="alert"><AdminEmptyState title="Fechamentos indisponíveis" description="Não foi possível consultar os fechamentos." /><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div> : rows.length === 0 ? <AdminEmptyState icon={FileCheck2} title="Nenhum fechamento encontrado" description="Não há fechamentos disponíveis para os filtros selecionados." /> : <>
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block"><table className="w-full text-sm"><thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground"><tr>{["Referência", "Prestador", "Período", "Total", "Situação", "Pagamento", ""].map((name) => <th key={name} className="px-4 py-3 font-medium">{name}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((s) => <tr key={s.id} className="transition-colors hover:bg-muted/40"><td className="px-4 py-4 font-mono text-xs"><Button variant="link" className="h-auto p-0 font-mono text-xs" onClick={() => setSelected(s)}>{s.code}</Button></td><td className="px-4 py-4 font-medium">{s.providerName ?? "Não informado"}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{date(s.periodStart)} – {date(s.periodEnd)}</td><td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums">{money(s.total)}</td><td className="px-4 py-4"><AdminStatusBadge tone={s.status === "pago" ? "success" : "info"}>{s.status === "pago" ? "Pago" : "Em aberto"}</AdminStatusBadge></td><td className="px-4 py-4 text-muted-foreground">{s.paidAt ? date(s.paidAt) : "—"}</td><td className="px-3"><Button size="icon" variant="ghost" aria-label={`Ver fechamento ${s.code}`} onClick={() => setSelected(s)}><ChevronRight className="size-4" /></Button></td></tr>)}</tbody></table></div>
      <div className="divide-y divide-border border-y border-border md:hidden">{rows.map((s) => <Button key={s.id} variant="ghost" className="h-auto w-full justify-start rounded-none px-1 py-4 text-left" onClick={() => setSelected(s)}><div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2"><div className="min-w-0"><p className="truncate font-semibold">{s.providerName ?? "Não informado"}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{s.code}</p><p className="mt-1 whitespace-normal text-xs text-muted-foreground">{date(s.periodStart)} – {date(s.periodEnd)}</p></div><div className="space-y-2 text-right"><strong className="block tabular-nums">{money(s.total)}</strong><AdminStatusBadge tone={s.status === "pago" ? "success" : "info"}>{s.status === "pago" ? "Pago" : "Em aberto"}</AdminStatusBadge></div></div></Button>)}</div>
    </>}
    <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}><SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[650px] [&>button]:text-primary-foreground">{selected && <>
      <SheetHeader className="shrink-0 border-b border-border bg-primary px-5 py-6 pr-12 text-left"><p className="text-xs font-semibold uppercase text-primary-foreground">Financeiro · Equipe</p><SheetTitle className="text-primary-foreground">Detalhes do fechamento</SheetTitle><SheetDescription className="text-primary-foreground">{selected.code}</SheetDescription></SheetHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-5 border-b border-border pb-5"><div><p className="text-xs text-muted-foreground">Prestador</p><p className="mt-1 break-words font-semibold">{selected.providerName ?? "Não informado"}</p></div><div><p className="mb-1 text-xs text-muted-foreground">Situação</p><AdminStatusBadge tone={selected.status === "pago" ? "success" : "info"}>{selected.status === "pago" ? "Pago" : "Em aberto"}</AdminStatusBadge></div><div className="col-span-2"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />Período de referência</p><p className="mt-1 text-sm">{date(selected.periodStart)} – {date(selected.periodEnd)}</p></div></div>
        <section><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="size-4 text-primary" />Serviços do fechamento <span className="ml-auto text-xs font-normal text-muted-foreground">{selected.items.length} itens</span></h3><div className="divide-y divide-border rounded-lg border border-border">{selected.items.map((item, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-l-2 border-l-primary px-4 py-3"><div><p className="text-xs text-muted-foreground">{date(item.date)} · {item.propertyName ?? "Imóvel não informado"}</p><p className="mt-1 break-words text-sm font-medium">{item.description}</p></div><strong className="text-sm tabular-nums">{money(item.amount)}</strong></div>)}{selected.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum serviço informado.</p>}</div></section>
        <section className="border-t border-border pt-5"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4 text-primary" />Pagamento</h3><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-muted-foreground">Data</dt><dd className="mt-1">{selected.paidAt ? date(selected.paidAt) : "Ainda não registrado"}</dd></div><div><dt className="text-xs text-muted-foreground">Forma</dt><dd className="mt-1">{selected.paymentMethod ?? "Não informada"}</dd></div></dl></section>
      </div><div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 p-5"><div><p className="text-xs text-muted-foreground">{selected.status === "pago" ? "Total pago" : "Total do fechamento"}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(selected.total)}</p></div><Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button></div>
    </>}</SheetContent></Sheet>
  </div>;
}