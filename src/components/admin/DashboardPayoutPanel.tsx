import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Wallet } from "lucide-react";

import { PayoutPropertyPhoto } from "@/components/admin/PayoutPropertyPicker";
import { Button } from "@/components/ui/button";
import { formatMoneyText } from "@/components/ui/money-input";
import { getSupabaseBrowserClient } from "@/lib/api/supabase-client";
import { payoutClosingSummary, payoutDueDate } from "@/lib/payout-closing";
import { previousCompetence } from "@/lib/payout-statement";

export interface DashboardPayoutProperty {
  id: string;
  code: string;
  nickname?: string | null;
  condominium_name?: string | null;
  unit?: string | null;
}

const propertyName = (p: DashboardPayoutProperty) =>
  [p.condominium_name, p.unit].filter(Boolean).join(" ") || p.nickname || p.code;

/** Painel da tela inicial: saldos de repasse do mês anterior, derivados (nunca gravados). */
export function DashboardPayoutPanel({ properties, covers }: { properties: DashboardPayoutProperty[]; covers: Record<string, string> }) {
  const month = previousCompetence();
  const ids = properties.map((p) => p.id);
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const from = `${month}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const q = useQuery({
    enabled: ids.length > 0,
    queryKey: ["payout", "closing", month, ids],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Indisponível");
      const [res, exp, tr, cond] = await Promise.all([
        supabase.from("payout_reservations").select("*").in("implementation_id", ids).gte("checkin_date", from).lte("checkin_date", to),
        supabase.from("property_expenses").select("*").in("implementation_id", ids).gte("occurred_on", from).lte("occurred_on", to),
        supabase.from("payout_transfers").select("*").in("implementation_id", ids).eq("competence", month),
        supabase.from("implementation_contract_conditions").select("implementation_id, administration_fee").in("implementation_id", ids),
      ]);
      for (const r of [res, exp, tr, cond]) if (r.error) throw r.error;
      const fees = Object.fromEntries((cond.data ?? []).map((c) => [c.implementation_id, Number(c.administration_fee ?? 20)]));
      return payoutClosingSummary(month, ids, fees, (res.data ?? []) as never, (exp.data ?? []) as never, (tr.data ?? []) as never);
    },
  });

  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const due = new Date(`${payoutDueDate(month)}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: "UTC" });
  const rows = q.data ?? [];
  const pendingRows = rows.filter((r) => r.state === "a_repassar");
  const incompleteRows = rows.filter((r) => r.state === "incompleto");
  const paidCount = rows.filter((r) => r.state === "ok").length;
  const totalPending = pendingRows.reduce((acc, r) => acc + r.balance, 0);
  const byId = new Map(properties.map((p) => [p.id, p]));
  const listed = [...incompleteRows, ...pendingRows, ...rows.filter((r) => r.state === "ok")].slice(0, 6);

  return (
    <section aria-label="Repasses do mês" className="dashboard-payout flex flex-col gap-4">
      <div className="dashboard-payout-summary flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2>Repasses <span>· {monthLabel}</span></h2>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--admin-text)]">
            {q.isPending ? "—" : `R$ ${formatMoneyText(totalPending)}`}
          </p>
          <p className="dashboard-balance-caption">Saldo pendente</p>
          <p className="dashboard-payout-deadline">Repasse até {due}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--admin-info-soft)] text-[var(--admin-primary)]">
          <Wallet className="size-5" />
        </span>
      </div>

      <div className="dashboard-payout-counts grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-[var(--admin-surface-subtle)] px-2 py-2.5">
          <p className="text-lg font-bold tabular-nums text-[var(--admin-text)]">{q.isPending ? "—" : pendingRows.length}</p>
          <p className="text-[11px] text-[var(--admin-muted)]">a repassar</p>
        </div>
        <div className="rounded-xl bg-[var(--admin-surface-subtle)] px-2 py-2.5">
          <p className="text-lg font-bold tabular-nums text-[var(--admin-text)]">{q.isPending ? "—" : incompleteRows.length}</p>
          <p className="text-[11px] text-[var(--admin-muted)]">incompletos</p>
        </div>
        <div className="rounded-xl bg-[var(--admin-surface-subtle)] px-2 py-2.5">
          <p className="text-lg font-bold tabular-nums text-[var(--admin-text)]">{q.isPending ? "—" : paidCount}</p>
          <p className="text-[11px] text-[var(--admin-muted)]">em dia</p>
        </div>
      </div>

      {q.isError ? (
        <p role="alert" className="text-sm text-destructive">Não foi possível carregar os repasses.</p>
      ) : q.isPending ? (
        <div className="grid gap-2">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-xl bg-[var(--admin-surface-subtle)]" />)}</div>
      ) : listed.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-[var(--admin-muted)]">
          <CheckCircle2 className="size-4 text-[var(--admin-primary)]" /> Nenhum imóvel em operação com repasses neste mês.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {listed.map((r) => {
            const p = byId.get(r.implementationId);
            if (!p) return null;
            return (
              <li key={r.implementationId}>
                <Link
                  to="/financeiro/repasses"
                  search={{ imovel: r.implementationId, mes: month }}
                  className="dashboard-payout-row flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm"
                >
                  <span className="dashboard-payout-property"><PayoutPropertyPhoto url={covers[p.id]} name={propertyName(p)} /><span className="min-w-0"><strong>{p.condominium_name || p.nickname || p.code}</strong><small>{p.unit || p.code}</small></span></span>
                  {r.state === "incompleto" ? (
                    <span className="dashboard-payment-state is-incomplete">
                      <AlertTriangle className="size-3.5" /> {r.missing} sem valor
                    </span>
                  ) : r.state === "a_repassar" ? (
                    <span className="dashboard-payment-amount">R$ {formatMoneyText(r.balance)}<small className="dashboard-payment-state is-pending">Pendente</small></span>
                  ) : (
                    <span className="dashboard-payment-state is-paid">
                      <CheckCircle2 className="size-3.5" /> Em dia
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Button asChild className="dashboard-payout-action mt-auto w-full">
        <Link to="/financeiro/repasses" search={{ imovel: undefined, mes: month }}>
          Ver demonstrativos <ArrowRight />
        </Link>
      </Button>
    </section>
  );
}
