import { MonthPicker } from "@/components/ui/month-picker";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSection, AdminStatusBadge } from "./AdminPrimitives";
import { getVfStatements } from "@/lib/vf-finance.functions";
import { formatBRL } from "@/lib/money";

export function VfFinancePanel() {
  const queryStatements = useServerFn(getVfStatements);
  const [month, setMonth] = useState("2026-10");
  const [property, setProperty] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getVfStatements>> | null>(null);
  const [error, setError] = useState("");
  async function consult() {
    setBusy(true); setError(""); setResult(null);
    try { setResult(await queryStatements({ data: { month, ...(property.trim() ? { property: property.trim() } : {}) } })); }
    catch { setError("Não foi possível consultar. Verifique seu acesso financeiro e tente novamente."); }
    finally { setBusy(false); }
  }
  const statement = result?.ok ? result.statement : null;
  return <AdminSection title="VF - Financeiro" action={<AdminStatusBadge tone="warning">Envio de despesas desativado</AdminStatusBadge>}>
    <form className="flex flex-wrap items-end gap-3 py-4" onSubmit={(event) => { event.preventDefault(); void consult(); }}>
      <label className="grid gap-1 text-sm">Competência<MonthPicker aria-label="Competência" required value={month} onValueChange={setMonth} /></label>
      <label className="grid min-w-0 flex-1 gap-1 text-sm">Identificador do imóvel<Input aria-label="Identificador do imóvel" placeholder="Todos os imóveis" maxLength={120} value={property} onChange={(event) => setProperty(event.target.value)} /></label>
      <Button type="submit" disabled={busy}><Search size={16} />{busy ? "Consultando…" : "Consultar demonstrativos"}</Button>
    </form>
    {(error || (result && !result.ok)) && <p role="alert" className="py-3 text-destructive">{error || (result && !result.ok ? result.error : "")}</p>}
    {statement && <>
      <div className="grid gap-3 border-y border-border py-4 sm:grid-cols-3">
        <div>Receitas líquidas<strong className="block text-xl">{formatBRL(statement.totals.net_revenue)}</strong></div>
        <div>Deduções<strong className="block text-xl">{formatBRL(statement.totals.deductions)}</strong></div>
        <div>Repasse calculado<strong className="block text-xl">{formatBRL(statement.totals.net_payout)}</strong></div>
      </div>
      {statement.properties.length === 0 ? <p className="py-8 text-muted-foreground">Sem movimentações nesta competência.</p> : <div className="divide-y divide-border">{statement.properties.map((item) => <details key={item.property} className="py-4">
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2"><span className="font-medium">{item.property}</span><span className="font-semibold">{formatBRL(item.net_payout)}</span></summary>
        <div className="mt-3 grid gap-2 text-sm"><p>Reservas: {item.revenue.reservations}</p><p>Receita líquida: {formatBRL(item.revenue.net_amount)}</p><p>Deduções: {formatBRL(item.deductions.total)}</p>{item.deductions.items.map((expense) => <p key={expense.external_id} className="flex flex-wrap justify-between gap-2 text-muted-foreground"><span>{expense.external_id} · {expense.kind}</span><span>{formatBRL(expense.amount)}</span></p>)}</div>
      </details>)}</div>}
    </>}
  </AdminSection>;
}