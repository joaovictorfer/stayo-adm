import { useQuery } from "@tanstack/react-query";
import { AlarmClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/api/supabase-client";
import { payoutClosingSummary, payoutDueDate } from "@/lib/payout-closing";
import { formatMoneyText } from "@/components/ui/money-input";

interface Prop { id: string; code: string; nickname?: string | null; condominium_name?: string | null; unit?: string | null }

export function PayoutClosingReminder({ properties, month, onOpen }: { properties: Prop[]; month: string; onOpen: (id: string) => void }) {
  const ids = properties.map((p) => p.id);
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
  const from = `${month}-01`, to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const q = useQuery({ enabled: ids.length > 0, queryKey: ["payout", "closing", month, ids], queryFn: async () => {
    const supabase = getSupabaseBrowserClient(); if (!supabase) throw new Error("Indisponível");
    const [res, exp, tr, cond] = await Promise.all([
      supabase.from("payout_reservations").select("*").in("implementation_id", ids).gte("checkin_date", from).lte("checkin_date", to),
      supabase.from("property_expenses").select("*").in("implementation_id", ids).gte("occurred_on", from).lte("occurred_on", to),
      supabase.from("payout_transfers").select("*").in("implementation_id", ids).eq("competence", month),
      supabase.from("implementation_contract_conditions").select("implementation_id, administration_fee").in("implementation_id", ids),
    ]);
    for (const r of [res, exp, tr, cond]) if (r.error) throw r.error;
    const fees = Object.fromEntries((cond.data ?? []).map((c) => [c.implementation_id, Number(c.administration_fee ?? 20)]));
    return payoutClosingSummary(month, ids, fees, (res.data ?? []) as never, (exp.data ?? []) as never, (tr.data ?? []) as never);
  } });
  if (!ids.length || q.isPending) return null;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">Não foi possível montar o lembrete do fechamento.</p>;
  const pending = q.data.filter((r) => r.state !== "ok");
  const due = new Date(`${payoutDueDate(month)}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: "UTC" });
  const name = (id: string) => { const p = properties.find((x) => x.id === id); return p ? [p.condominium_name, p.unit].filter(Boolean).join(" ") || p.nickname || p.code : ""; };
  return <section aria-label="Lembrete do repasse" className="rounded-2xl border bg-card p-4 shadow-sm">
    <div className="flex items-center gap-2 text-sm font-semibold"><AlarmClock className="size-4 text-primary" /> Repasse até {due}</div>
    {pending.length === 0 ? <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-primary" /> Todos os imóveis estão com o repasse em dia neste mês.</p> :
      <ul className="mt-3 grid gap-2">{pending.map((r) => <li key={r.implementationId}>
        <button type="button" onClick={() => onOpen(r.implementationId)} className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm hover:bg-muted">
          <span className="min-w-0 truncate font-medium">{name(r.implementationId)}</span>
          {r.state === "incompleto" ? <span className="flex shrink-0 items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3.5" /> {r.missing} reserva(s) sem valor</span>
            : <span className="shrink-0 tabular-nums font-semibold">R$ {formatMoneyText(r.balance)}</span>}
        </button></li>)}</ul>}
  </section>;
}
