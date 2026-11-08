import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { syncCentralReservations, importCentralOwners } from "@/lib/stayo-central/sync.functions";
import { AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/api/supabase-client";
import { computeStatement, competenceOf, previousCompetence, type PayoutFlow } from "@/lib/payout-statement";

export const Route = createFileRoute("/financeiro/repasses")({
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
const monthRange = (m: string) => { const [y, mo] = m.split("-").map(Number); const end = new Date(Date.UTC(y!, mo!, 0)).toISOString().slice(0, 10); return [`${m}-01`, end] as const; };

function Page() {
  const qc = useQueryClient();
  const [impl, setImpl] = useState("");
  const [month, setMonth] = useState(previousCompetence());
  const props = useQuery({ queryKey: ["payout", "props"], queryFn: async () => {
    const { data, error } = await db().from("implementation_projects").select("id, code, nickname, condominium_name, unit").order("code");
    if (error) throw error; return data;
  } });
  const [from, to] = monthRange(month);
  const data = useQuery({ enabled: !!impl, queryKey: ["payout", impl, month], queryFn: async () => {
    const c = db();
    const [res, exp, tr, cond] = await Promise.all([
      c.from("payout_reservations").select("*").eq("implementation_id", impl).gte("checkin_date", from).lte("checkin_date", to).order("checkin_date"),
      c.from("property_expenses").select("*").eq("implementation_id", impl).gte("occurred_on", from).lte("occurred_on", to).order("occurred_on"),
      c.from("payout_transfers").select("*").eq("implementation_id", impl).eq("competence", month).order("paid_on"),
      c.from("implementation_contract_conditions").select("administration_fee").eq("implementation_id", impl).maybeSingle(),
    ]);
    for (const r of [res, exp, tr]) if (r.error) throw r.error;
    return { res: res.data!, exp: exp.data!, tr: tr.data!, fee: Number(cond.data?.administration_fee ?? 20) };
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

  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Financeiro" title="Relatório de repasse" description="Reservas do mês, despesas e quanto falta repassar ao proprietário." actions={<Link to="/financeiro" className="admin-inline-link">Financeiro</Link>} />
    <div className="admin-panel flex flex-wrap gap-3 p-4">
      <label className="grid gap-1 text-sm">Imóvel
        <select className="h-11 min-w-64 rounded-md border bg-background px-3" value={impl} onChange={(e) => setImpl(e.target.value)}>
          <option value="">Selecione…</option>
          {props.data?.map((p) => <option key={p.id} value={p.id}>{p.code} · {[p.condominium_name, p.unit].filter(Boolean).join(" ") || p.nickname || "Sem nome"}</option>)}
        </select></label>
      <label className="grid gap-1 text-sm">Mês de referência
        <Input type="month" className="h-11" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
      <div className="flex items-end gap-2">
        <Button className="h-11" disabled={!impl || syncing} onClick={runSync}><RefreshCw className={syncing ? "animate-spin" : ""} /> Puxar reservas do Guia</Button>
        <Button variant="outline" className="h-11" disabled={syncing} onClick={runOwners}>Importar proprietários vinculados</Button>
      </div>
    </div>

    {!impl ? <p className="text-sm text-muted-foreground">Escolha um imóvel para ver o relatório.</p>
    : data.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar. Verifique se você tem acesso ao financeiro.</p>
    : !data.data || !s ? <p className="text-sm text-muted-foreground">Carregando…</p> : <>
      <Section title="1 · Airbnb — repasse automático" subtitle="A plataforma paga o proprietário direto. Saldo STAYO desta parte: R$ 0,00.">
        <ResTable rows={auto} direct onDelete={(id) => remove("payout_reservations", id)} />
        <p className="text-sm">Total das reservas: <b>{brl(s.autoGross)}</b> · Pago direto ao proprietário: <b>{brl(s.autoOwnerDirect)}</b></p>
        <ReservationForm impl={impl} flow="platform_auto" month={month} onSaved={refresh} />
      </Section>
      <Section title="2 · Reservas recebidas pela STAYO" subtitle="Booking, Decolar, reservas diretas e outras.">
        <ResTable rows={stayo} onDelete={(id) => remove("payout_reservations", id)} />
        <ReservationForm impl={impl} flow="stayo" month={month} onSaved={refresh} />
      </Section>
      <Section title="3 · Despesas do mês" subtitle="Lance as despesas assim que acontecerem; elas entram no mês da data informada.">
        {data.data.exp.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma despesa neste mês.</p> :
          <ul className="divide-y text-sm">{data.data.exp.map((e) => <li key={e.id} className="flex items-center gap-3 py-2"><span className="w-20">{br(e.occurred_on)}</span><span className="flex-1">{CATEGORIES[e.category as keyof typeof CATEGORIES]} · {e.description}{!e.charged_to_owner && " (por conta da STAYO)"}</span><b>{brl(e.amount_cents)}</b><Del onClick={() => remove("property_expenses", e.id)} /></li>)}</ul>}
        <ExpenseForm impl={impl} month={month} onSaved={refresh} />
      </Section>
      <Section title="4 · Balancete" subtitle={`Administração de ${data.data.fee}% sobre a diária, conforme o contrato.`}>
        <dl className="grid gap-1 text-sm">
          <Line l="Recebido pela STAYO (reservas da seção 2)" v={s.stayoGross} />
          <Line l="(−) Taxas das plataformas" v={-s.platformFees} />
          <Line l="(−) Limpezas" v={-s.cleaning} />
          <Line l={`(−) Administração STAYO (${data.data.fee}%)`} v={-s.adminFee} />
          <Line l="= Parte do proprietário" v={s.ownerShare} strong />
          <Line l="(−) Despesas do mês" v={-s.expenseTotal} />
          <Line l="(−) Já repassado neste mês" v={-s.transferred} />
        </dl>
        <div className={`mt-3 rounded-lg p-4 ${s.status === "a_compensar" ? "bg-destructive/10" : "bg-primary/10"}`}>
          <p className="text-sm">{s.status === "a_repassar" ? "Falta repassar ao proprietário (até o dia 10)" : s.status === "a_compensar" ? "Saldo a compensar pelo proprietário" : "Saldo zerado"}</p>
          <p className="text-2xl font-semibold">{brl(Math.abs(s.balance))}</p>
        </div>
        {data.data.tr.length > 0 && <ul className="mt-3 divide-y text-sm">{data.data.tr.map((t) => <li key={t.id} className="flex items-center gap-3 py-2"><span className="flex-1">Repasse em {br(t.paid_on)} · {t.method.toUpperCase()}</span><b>{brl(t.amount_cents)}</b><Del onClick={() => remove("payout_transfers", t.id)} /></li>)}</ul>}
        <TransferForm impl={impl} month={month} suggested={Math.max(0, s.balance)} onSaved={refresh} />
      </Section>
    </>}
  </div>;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="admin-panel space-y-3 p-4"><div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{subtitle}</p></div>{children}</section>;
}
const Line = ({ l, v, strong }: { l: string; v: number; strong?: boolean }) => <div className={`flex justify-between ${strong ? "border-t pt-1 font-semibold" : ""}`}><dt>{l}</dt><dd className="tabular-nums">{brl(v)}</dd></div>;
const Del = ({ onClick }: { onClick: () => void }) => <button type="button" aria-label="Excluir" onClick={onClick} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>;
const maskCpf = (c?: string | null) => c ? `***.${c.replace(/\D/g, "").slice(3, 6)}.***-**` : "—";

type Res = { id: string; channel: string; reservation_code: string | null; guest_name: string; guest_cpf: string | null; checkin_date: string; checkout_date: string; gross_cents: number; cleaning_cents: number; platform_fee_cents: number; owner_direct_cents: number };
function ResTable({ rows, direct, onDelete }: { rows: Res[]; direct?: boolean; onDelete: (id: string) => void }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nenhuma reserva neste mês.</p>;
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th className="py-1">Origem</th><th>Hóspede titular</th><th>CPF</th><th>Período</th><th className="text-right">Valor</th>{direct ? <th className="text-right">Pago direto</th> : <><th className="text-right">Limpeza</th><th className="text-right">Taxa canal</th></>}<th /></tr></thead>
    <tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="py-2">{CHANNELS[r.channel as keyof typeof CHANNELS]}{r.reservation_code && <span className="block text-xs text-muted-foreground">{r.reservation_code}</span>}</td><td>{r.guest_name}</td><td title="CPF completo no PDF do relatório">{maskCpf(r.guest_cpf)}</td><td>{br(r.checkin_date)} – {br(r.checkout_date)}</td><td className="text-right">{brl(r.gross_cents)}</td>{direct ? <td className="text-right">{brl(r.owner_direct_cents)}</td> : <><td className="text-right">{brl(r.cleaning_cents)}</td><td className="text-right">{brl(r.platform_fee_cents)}</td></>}<td><Del onClick={() => onDelete(r.id)} /></td></tr>)}</tbody></table></div>;
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
      <F label="Limpeza (R$)"><Input inputMode="decimal" value={f.cleaning} onChange={set("cleaning")} /></F>
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
