import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, CalendarDays, CreditCard, Coins, Wallet, BedDouble, House, Globe, Plane, FileDown, Users, ArrowUpRight, Search, X, Building2, ArrowRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { syncCentralReservations, importCentralOwners } from "@/lib/stayo-central/sync.functions";
import { AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/api/supabase-client";
import { computeStatement, competenceOf, previousCompetence, type PayoutFlow } from "@/lib/payout-statement";
import { payoutPdfReadiness, payoutPdfSplit, type PayoutPdfReservation } from "@/lib/pdf/payout-pdf";
import { listImplementationCoverUrls } from "@/lib/api/implementation-covers";
import { PayoutPropertyPicker, PayoutPropertyPhoto, payoutPropertyName } from "@/components/admin/PayoutPropertyPicker";
import { isPayoutPropertyEligible, matchesPayoutPropertySearch } from "@/lib/payout-properties";

export const Route = createFileRoute("/financeiro/repasses")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({ q: typeof search['q'] === "string" ? search['q'] : "" }),
  head: () => ({ meta: [
    { title: "Relatório de repasse — STAYO Admin" },
    { name: "description", content: "Reservas, despesas e balancete mensal de repasse por imóvel." },
    { property: "og:title", content: "Relatório de repasse — STAYO Admin" },
    { property: "og:description", content: "Reservas Airbnb com repasse automático, reservas STAYO e balancete do mês." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

const CHANNELS = { airbnb: "Airbnb", booking: "Booking", decolar: "Decolar", direta: "Reserva direta", outro: "Outro" } as const;
const CATEGORIES = { manutencao: "Manutenção", lavanderia: "Lavanderia", compras: "Compras / enxoval", limpeza: "Limpeza", taxas: "Taxas", outro: "Outro" } as const;
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toCents = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".") || 0) * 100);
const br = (d: string) => d.split("-").reverse().join("/");
const db = () => { const c = getSupabaseBrowserClient(); if (!c) throw new Error("Indisponível"); return c; };
const monthRange = (m: string) => { const [y = 2026, mo = 1] = m.split("-").map(Number); const end = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); return [`${m}-01`, end] as const; };

function Page() {
  const qc = useQueryClient();
  const { q: searchText } = Route.useSearch();
  const q = searchText ?? "";
  const navigate = Route.useNavigate();
  const setSearch = (q: string) => navigate({ search: { q }, replace: true });
  const [impl, setImpl] = useState("");
  const [month, setMonth] = useState(previousCompetence());
  const props = useQuery({ queryKey: ["payout", "props"], queryFn: async () => {
    const { data, error } = await db().from("implementation_projects").select("id, code, nickname, condominium_name, unit, owner_id, status, core_property_id").order("code");
    if (error) throw error; return data.filter(isPayoutPropertyEligible);
  } });
  const propertyIds = props.data?.map(p => p.id) ?? [];
  const covers = useQuery({ queryKey: ["payout", "covers", propertyIds], enabled: propertyIds.length > 0, queryFn: () => listImplementationCoverUrls(propertyIds), staleTime: 30 * 60 * 1000 });
  const [from, to] = monthRange(month);
  const data = useQuery({ enabled: !!impl, queryKey: ["payout", impl, month], queryFn: async () => {
    const c = db();
    const [res, exp, tr, cond] = await Promise.all([
      c.from("payout_reservations").select("*").eq("implementation_id", impl).gte("checkin_date", from).lte("checkin_date", to).order("checkin_date"),
      c.from("property_expenses").select("*").eq("implementation_id", impl).gte("occurred_on", from).lte("occurred_on", to).order("occurred_on"),
      c.from("payout_transfers").select("*").eq("implementation_id", impl).eq("competence", month).order("paid_on"),
      c.from("implementation_contract_conditions").select("administration_fee").eq("implementation_id", impl).maybeSingle(),
    ]);
    for (const r of [res, exp, tr, cond]) if (r.error) throw r.error;
    return { res: res.data ?? [], exp: exp.data ?? [], tr: tr.data ?? [], fee: Number(cond.data?.administration_fee ?? 20) };
  } });
  const refresh = () => qc.invalidateQueries({ queryKey: ["payout", impl, month] });
  const s = useMemo(() => data.data ? computeStatement(month, data.data.fee, data.data.res as never, data.data.exp, data.data.tr) : null, [data.data, month]);
  const remove = async (table: "payout_reservations" | "property_expenses" | "payout_transfers", id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await db().from(table).delete().eq("id", id);
    if (error) toast.error("Não foi possível excluir."); else refresh();
  };
  const syncFn = useServerFn(syncCentralReservations);
  const ownersFn = useServerFn(importCentralOwners);
  const [syncing, setSyncing] = useState(false);
  const runSync = async () => {
    setSyncing(true);
    try {
      const r = await syncFn({ data: { implementationId: impl, month } });
      if (!r.ok) toast.error("Esta ficha ainda não está vinculada a um imóvel do Guia STAYO (aba Imóvel).");
      else { toast.success(`${r.found} reserva(s) no mês · ${r.imported} nova(s), ${r.updated} atualizada(s).`); refresh(); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao consultar o Guia."); } finally { setSyncing(false); }
  };
  const runOwners = async () => {
    setSyncing(true);
    try { const r = await ownersFn(); toast.success(`${r.linkedProperties} imóvel(is) vinculado(s) · ${r.created} proprietário(s) criado(s), ${r.linked} ficha(s) ligada(s).`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao consultar o Guia."); } finally { setSyncing(false); }
  };
  const auto = data.data?.res.filter((r) => r.payout_flow === "platform_auto") ?? [];
  const stayo = data.data?.res.filter((r) => r.payout_flow === "stayo") ?? [];

  const selectedProperty = props.data?.find((p) => p.id === impl);
  const propertyTitle = selectedProperty ? [selectedProperty.condominium_name, selectedProperty.unit].filter(Boolean).join(" ") || selectedProperty.nickname || selectedProperty.code : "";
  const monthTitle = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const [generating, setGenerating] = useState(false);
  const pdfReady = !!data.data && payoutPdfReadiness({ competence: month, reservations: data.data.res as PayoutPdfReservation[] });
  const runPdf = async () => {
    if (!selectedProperty || !data.data || !pdfReady) return;
    setGenerating(true);
    try {
      const snapshot = data.data;
      const owner = selectedProperty.owner_id ? await db().from("owner_records").select("name").eq("id", selectedProperty.owner_id).maybeSingle() : null;
      if (owner?.error) throw owner.error;
      const covers = await listImplementationCoverUrls([selectedProperty.id]).catch(() => ({} as Record<string, string>));
      const { downloadPayoutPdf } = await import("@/lib/pdf/payout-download");
      await downloadPayoutPdf({ property: propertyTitle, propertyCode: selectedProperty.code, ownerName: owner?.data?.name, competence: month, adminFeePercent: snapshot.fee, reservations: snapshot.res as PayoutPdfReservation[], expenses: snapshot.exp, transfers: snapshot.tr }, covers[selectedProperty.id]);
      toast.success("PDF gerado com o CPF completo dos hóspedes.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF."); }
    finally { setGenerating(false); }
  };

  return <div className="payout-workspace">
    <AdminPageHeader title="Relatório de repasse" description={propertyTitle ? `${propertyTitle} · ${monthTitle}` : "Reservas, despesas e repasses por imóvel"} actions={<Link to="/financeiro" className="admin-inline-link">Financeiro</Link>} />
    <div className={`payout-filters${!impl ? " is-browsing" : ""}`}>
      {impl ? <PayoutPropertyPicker properties={props.data ?? []} covers={covers.data ?? {}} value={impl} onChange={setImpl} loading={props.isPending} error={props.isError} /> : <div className="payout-catalog-search"><Search aria-hidden="true" /><Input aria-label="Pesquisar imóveis" placeholder="Buscar imóvel, unidade ou código" value={q} onChange={e => setSearch(e.target.value)} />{q && <Button variant="ghost" size="icon" aria-label="Limpar pesquisa" onClick={() => setSearch("")}><X /></Button>}</div>}
      <label className="payout-month-field grid gap-2 text-xs font-semibold text-muted-foreground">Mês de referência
        <Input type="month" aria-label="Mês de referência" className="h-11 text-foreground" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
      {impl && <div className="payout-filter-actions">
        <Button variant="outline" size="icon" className="h-11 w-11" disabled={syncing} onClick={runOwners} title="Importar proprietários vinculados" aria-label="Importar proprietários vinculados"><Users /></Button>
        <Button className="payout-primary h-11" disabled={!impl || syncing} onClick={runSync}><RefreshCw className={syncing ? "animate-spin" : ""} /> Atualizar reservas</Button>
        <Button variant="outline" className="h-11" disabled={!impl || !pdfReady || data.isFetching || generating || syncing} onClick={runPdf} title={!pdfReady && impl ? "Complete os valores ausentes antes de gerar o PDF" : "Baixar relatório mensal com CPF completo"}><FileDown />{generating ? "Gerando PDF…" : "Gerar PDF"}</Button>
      </div>}
    </div>

    {selectedProperty && <div className="payout-selected-property">
      <PayoutPropertyPhoto url={covers.data?.[impl]} name={propertyTitle} large />
      <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{selectedProperty.code}</p><h2 className="mt-1 text-xl font-semibold">{propertyTitle}</h2><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays size={14} />{monthTitle}</p></div>
      <Link to="/implantacao/$id" params={{ id: impl }} className="admin-inline-link shrink-0" aria-label={`Abrir ficha de ${propertyTitle}`}>Ficha do imóvel <ArrowUpRight size={15} /></Link>
    </div>}

    {!impl ? <section className="payout-property-browser">
      <div className="payout-catalog-heading"><div><span className="payout-catalog-eyebrow">FECHAMENTO MENSAL</span><h2>Imóveis em operação</h2></div><span className="payout-catalog-count">{props.data?.filter(p => matchesPayoutPropertySearch(p, q)).length ?? 0} imóveis</span></div>
      {props.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os imóveis.</p> : props.isPending ? <div className="payout-property-grid">{[1, 2, 3, 4, 5, 6].map(n => <div key={n} className="h-72 animate-pulse rounded-md bg-muted" />)}</div> : !props.data?.some(p => matchesPayoutPropertySearch(p, q)) ? <div className="payout-catalog-empty"><Building2 /><h3>{q ? "Nenhum imóvel encontrado" : "Nenhum imóvel em operação"}</h3>{q && <Button variant="outline" onClick={() => setSearch("")}>Limpar pesquisa</Button>}</div> : <div className="payout-property-grid">{props.data?.filter(p => matchesPayoutPropertySearch(p, q)).map(p => <Button key={p.id} variant="outline" className="payout-property-tile" onClick={() => setImpl(p.id)} aria-label={`Abrir relatório de ${payoutPropertyName(p)}`}>
        <span className="payout-tile-cover"><PayoutPropertyPhoto url={covers.data?.[p.id]} name={payoutPropertyName(p)} large /><span className="payout-tile-status"><span />Em operação</span></span>
        <span className="payout-tile-body"><span className="payout-tile-code">{p.code}</span><span className="payout-tile-name">{payoutPropertyName(p)}</span><span className="payout-tile-footer"><span>{monthTitle}</span><span className="payout-tile-arrow"><ArrowRight size={18} /></span></span></span>
      </Button>)}</div>}
    </section>
    : data.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar. Verifique se você tem acesso ao financeiro.</p>
    : !data.data || !s ? <p className="text-sm text-muted-foreground">Carregando…</p> : <>
      <div className="payout-metrics grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric tone="navy" icon={<CalendarDays />} label="Reservas do mês" value={String(data.data.res.length)} />
        <Metric tone="received" icon={<CreditCard />} label="Recebido pela STAYO" value={s.incompleteCount ? "Saldo provisório" : brl(s.stayoGross)} />
        <Metric tone="neutral" icon={<Coins />} label="Pago pela plataforma" value={auto.some(r => r.missing_amounts?.includes("owner_direct")) ? "Não informado" : brl(s.autoOwnerDirect)} />
        <Metric tone={s.complete && s.status === "a_compensar" ? "danger" : "balance"} icon={<Wallet />} label={!s.complete ? "Saldo do mês" : s.status === "a_compensar" ? "Saldo a compensar" : s.status === "zerado" ? "Saldo zerado" : "Saldo a repassar"} value={s.complete ? brl(Math.abs(s.balance)) : "Não calculado"} />
      </div>
      <Section title="Reservas recebidas pela STAYO" count={stayo.length}>
        <ResTable rows={stayo} feePercent={data.data.fee} onDelete={(id) => remove("payout_reservations", id)} />
        <ReservationForm impl={impl} flow="stayo" month={month} onSaved={refresh} />
      </Section>
      <Section title="Repasse direto pela plataforma" count={auto.length} subtitle="Pagamento direto ao proprietário; não compõe o saldo STAYO.">
        <ResTable rows={auto} direct onDelete={(id) => remove("payout_reservations", id)} />
        {s.autoIncompleteCount > 0 && <p className="text-sm text-muted-foreground">{s.autoIncompleteCount} reserva(s) sem valor no Guia — fora do total abaixo.</p>}
        {auto.length > 0 && <p className="text-sm">Total das reservas: <b>{brl(s.autoGross)}</b> · Pago direto ao proprietário: <b>{auto.some(r => r.missing_amounts?.includes("owner_direct")) ? "Não informado" : brl(s.autoOwnerDirect)}</b></p>}
        <ReservationForm impl={impl} flow="platform_auto" month={month} onSaved={refresh} />
      </Section>
      <Section title="Despesas do mês">
        {data.data.exp.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma despesa neste mês.</p> :
          <ul className="divide-y text-sm">{data.data.exp.map((e) => <li key={e.id} className="flex items-center gap-3 py-2"><span className="w-20">{br(e.occurred_on)}</span><span className="flex-1">{CATEGORIES[e.category as keyof typeof CATEGORIES]} · {e.description}{!e.charged_to_owner && " (por conta da STAYO)"}</span><b>{brl(e.amount_cents)}</b><Del onClick={() => remove("property_expenses", e.id)} /></li>)}</ul>}
        <ExpenseForm impl={impl} month={month} onSaved={refresh} />
      </Section>
      <Section title="Balancete" subtitle={`Administração de ${data.data.fee}% sobre a diária, conforme o contrato.`}>
        <dl className="grid gap-1 text-sm">
          <Line l="Valor total" v={s.stayoGross - s.cleaning} />
          <Line l="(−) Taxas das plataformas" v={-s.platformFees} />
          <Line l={`(−) Administração STAYO (${data.data.fee}%)`} v={-s.adminFee} />
          <Line l="= Parte do proprietário" v={s.ownerShare} strong />
          <Line l="(−) Despesas do mês" v={-s.expenseTotal} />
          <Line l="(−) Já repassado neste mês" v={-s.transferred} />
        </dl>
        {!s.complete && <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <b>Saldo provisório:</b> {s.incompleteCount} reserva(s) recebidas pela STAYO estão sem valor no Guia STAYO. Elas não foram contadas como R$ 0,00 reais — complete os valores antes de repassar ou gerar o relatório.</p>}
        {s.complete ? <div className={`mt-3 rounded-md p-4 ${s.status === "a_compensar" ? "bg-destructive/10" : "payout-balance-total"}`}>
          <p className="text-sm">{s.status === "a_repassar" ? "Falta repassar ao proprietário (até o dia 10)" : s.status === "a_compensar" ? "Saldo a compensar pelo proprietário" : "Saldo zerado"}</p>
          <p className="text-2xl font-semibold">{brl(Math.abs(s.balance))}</p>
        </div> : <div className="mt-3 rounded-lg bg-muted p-4">
          <p className="text-sm">Saldo do mês</p>
          <p className="text-2xl font-semibold">Não calculado</p>
          <p className="text-xs text-muted-foreground">Aparece quando todas as reservas tiverem valor.</p>
        </div>}
        {data.data.tr.length > 0 && <ul className="mt-3 divide-y text-sm">{data.data.tr.map((t) => <li key={t.id} className="flex items-center gap-3 py-2"><span className="flex-1">Repasse em {br(t.paid_on)} · {t.method.toUpperCase()}</span><b>{brl(t.amount_cents)}</b><Del onClick={() => remove("payout_transfers", t.id)} /></li>)}</ul>}
        <TransferForm impl={impl} month={month} suggested={Math.max(0, s.balance)} onSaved={refresh} />
      </Section>
    </>}
  </div>;
}

function Metric({ tone, icon, label, value }: { tone: string; icon: ReactNode; label: string; value: string }) {
  return <div className={`payout-metric is-${tone}`}><span className="payout-metric-icon" aria-hidden="true">{icon}</span><div className="min-w-0"><p>{label}</p><strong>{value}</strong></div></div>;
}
function Section({ title, subtitle, count, children }: { title: string; subtitle?: string; count?: number; children: ReactNode }) {
  return <section className="payout-section space-y-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-xl font-semibold">{title}</h2>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>{count !== undefined && <span className="text-sm text-muted-foreground">{count} {count === 1 ? "reserva" : "reservas"}</span>}</div>{children}</section>;
}
const Line = ({ l, v, strong }: { l: string; v: number; strong?: boolean }) => <div className={`flex justify-between gap-4 py-2 ${strong ? "border-t font-semibold" : ""}`}><dt>{l}</dt><dd className="shrink-0 tabular-nums">{brl(v)}</dd></div>;
const Del = ({ onClick }: { onClick: () => void }) => <Button variant="ghost" size="icon" type="button" aria-label="Excluir" title="Excluir lançamento" onClick={onClick} className="text-muted-foreground hover:text-destructive"><Trash2 size={16} /></Button>;
const maskCpf = (c?: string | null) => c ? `***.${c.replace(/\D/g, "").slice(3, 6)}.***-**` : "—";

type Res = PayoutPdfReservation & { id: string };
/** Valor que o Guia não informou: nunca exibido como R$ 0,00. */
const Amount = ({ r, k, v }: { r: Res; k: string; v: number }) => r.missing_amounts?.includes(k)
  ? <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive" title="O Guia STAYO ainda não informou este valor">Não informado</span>
  : <>{brl(v)}</>;
function ResTable({ rows, direct, feePercent = 20, onDelete }: { rows: Res[]; direct?: boolean; feePercent?: number; onDelete: (id: string) => void }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nenhuma reserva neste mês.</p>;
  return <div className="overflow-x-auto"><table className="payout-table w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th>Origem</th><th>Hóspede titular</th><th>Período</th><th className="text-right whitespace-nowrap">Valor total</th>{direct ? <th className="text-right">Pago direto</th> : <><th className="text-right whitespace-nowrap">STAYO · {feePercent}%</th><th className="text-right whitespace-nowrap">Proprietário · {100 - feePercent}%</th></>}<th><span className="sr-only">Ações</span></th></tr></thead>
    <tbody>{rows.map((r) => { const Icon = r.channel === "airbnb" ? House : r.channel === "direta" ? BedDouble : r.channel === "decolar" ? Plane : Globe; const split = payoutPdfSplit(r, feePercent); const splitKey = r.missing_amounts?.find(k => ["gross", "cleaning", "platform_fee"].includes(k)) ?? "gross"; return <tr key={r.id} data-direct={r.channel === "direta"}><td><span className="inline-flex items-center gap-2 font-semibold"><span className={`payout-channel is-${r.channel}`} aria-hidden="true"><Icon size={17} /></span>{CHANNELS[r.channel as keyof typeof CHANNELS] ?? "Outro"}</span>{r.reservation_code && <span className="mt-1 block text-xs text-muted-foreground">{r.reservation_code}</span>}</td><td><span className="font-medium">{r.guest_name}</span><span className="mt-1 block text-xs text-muted-foreground" title="CPF completo no PDF do relatório">CPF {maskCpf(r.guest_cpf)}</span></td><td className="whitespace-nowrap">{br(r.checkin_date)} – {br(r.checkout_date)}</td><td className="text-right font-semibold whitespace-nowrap"><Amount r={r} k={direct ? "gross" : splitKey} v={direct ? r.gross_cents : split.base} /></td>{direct ? <td className="text-right whitespace-nowrap"><Amount r={r} k="owner_direct" v={r.owner_direct_cents} /></td> : <><td className="text-right whitespace-nowrap"><Amount r={r} k={splitKey} v={split.stayo} /></td><td className="text-right font-semibold whitespace-nowrap"><Amount r={r} k={splitKey} v={split.owner} /></td></>}<td><Del onClick={() => onDelete(r.id)} /></td></tr>; })}</tbody></table></div>;
}

function useSaver(onSaved: () => void) {
  const [busy, setBusy] = useState(false);
  return { busy, run: async (fn: () => PromiseLike<{ error: unknown }>, reset: () => void) => { setBusy(true); const { error } = await fn(); setBusy(false); if (error) toast.error("Não foi possível salvar."); else { toast.success("Salvo"); reset(); onSaved(); } } };
}
const F = ({ label, children }: { label: string; children: ReactNode }) => <label className="grid gap-1 text-xs">{label}{children}</label>;

function ReservationForm({ impl, flow, month, onSaved }: { impl: string; flow: PayoutFlow; month: string; onSaved: () => void }) {
  const blank = { channel: flow === "platform_auto" ? "airbnb" : "booking", code: "", guest: "", cpf: "", ci: `${month}-01`, co: `${month}-02`, gross: "", cleaning: "", fee: "", direct: "" };
  const [open, setOpen] = useState(false); const [f, setF] = useState(blank); const { busy, run } = useSaver(onSaved);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}><Plus size={16} />Adicionar reserva</Button>;
  const submit = (e: FormEvent) => { e.preventDefault();
    if (f.guest.trim().split(/\s+/).length < 2) { toast.error("Informe o nome completo do hóspede titular."); return; }
    if (competenceOf(f.ci) !== month) toast.message("O check-in é de outro mês; a reserva aparecerá naquele mês.");
    run(() => db().from("payout_reservations").insert({ implementation_id: impl, payout_flow: flow, channel: f.channel, reservation_code: f.code || null, guest_name: f.guest.trim(), guest_cpf: f.cpf.replace(/\D/g, "") || null, checkin_date: f.ci, checkout_date: f.co, gross_cents: toCents(f.gross), cleaning_cents: toCents(f.cleaning), platform_fee_cents: toCents(f.fee), owner_direct_cents: toCents(f.direct) }), () => { setF(blank); setOpen(false); }); };
  return <form onSubmit={submit} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
    <F label="Origem"><select className="h-10 rounded-md border bg-background px-2" value={f.channel} onChange={set("channel")}>{Object.entries(CHANNELS).filter(([k]) => flow === "platform_auto" ? k === "airbnb" || k === "outro" : true).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
    <F label="Código da reserva"><Input value={f.code} onChange={set("code")} /></F>
    <F label="Hóspede titular (nome completo)"><Input required value={f.guest} onChange={set("guest")} /></F>
    <F label="CPF do titular"><Input inputMode="numeric" value={f.cpf} onChange={set("cpf")} /></F>
    <F label="Check-in"><Input type="date" required value={f.ci} onChange={set("ci")} /></F>
    <F label="Check-out"><Input type="date" required value={f.co} min={f.ci} onChange={set("co")} /></F>
    <F label="Valor total da reserva (R$)"><Input inputMode="decimal" required value={f.gross} onChange={set("gross")} /></F>
    {flow === "platform_auto" ? <F label="Pago direto ao proprietário (R$)"><Input inputMode="decimal" value={f.direct} onChange={set("direct")} /></F> : <>
      
      <F label="Taxa do canal (R$)"><Input inputMode="decimal" value={f.fee} onChange={set("fee")} /></F></>}
    <div className="flex items-end gap-2 sm:col-span-3"><Button disabled={busy}>Salvar reserva</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button></div>
  </form>;
}

function ExpenseForm({ impl, month, onSaved }: { impl: string; month: string; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const blank = { date: competenceOf(today) === month ? today : `${month}-01`, cat: "manutencao", desc: "", value: "", owner: true };
  const [open, setOpen] = useState(false); const [f, setF] = useState(blank); const { busy, run } = useSaver(onSaved);
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}><Plus size={16} />Lançar despesa</Button>;
  return <form className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); const v = toCents(f.value); if (v <= 0) { toast.error("Informe o valor."); return; } run(() => db().from("property_expenses").insert({ implementation_id: impl, occurred_on: f.date, category: f.cat, description: f.desc.trim(), amount_cents: v, charged_to_owner: f.owner }), () => { setF(blank); setOpen(false); }); }}>
    <F label="Data"><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></F>
    <F label="Tipo"><select className="h-10 rounded-md border bg-background px-2" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
    <F label="Descrição"><Input required value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></F>
    <F label="Valor (R$)"><Input inputMode="decimal" required value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></F>
    <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" checked={f.owner} onChange={(e) => setF({ ...f, owner: e.target.checked })} />Descontar do proprietário</label>
    <div className="flex gap-2 sm:col-span-4"><Button disabled={busy}>Salvar despesa</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button></div>
  </form>;
}

function TransferForm({ impl, month, suggested, onSaved }: { impl: string; month: string; suggested: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false); const [value, setValue] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const { busy, run } = useSaver(onSaved);
  if (!open) return <Button className="mt-3" variant="outline" onClick={() => { setValue((suggested / 100).toFixed(2).replace(".", ",")); setOpen(true); }}><Plus size={16} />Registrar repasse feito</Button>;
  return <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const v = toCents(value); if (v <= 0) { toast.error("Informe o valor."); return; } run(() => db().from("payout_transfers").insert({ implementation_id: impl, competence: month, paid_on: date, amount_cents: v }), () => setOpen(false)); }}>
    <F label="Data do repasse"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></F>
    <F label="Valor (R$)"><Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></F>
    <Button disabled={busy}>Salvar</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
  </form>;
}
