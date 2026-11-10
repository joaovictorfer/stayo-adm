import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { listPayoutAdjustments, PAYOUT_FIELD_LABEL } from "../../../lib/api/core-client";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Histórico imutável dos valores de repasse lançados manualmente para este imóvel. */
export function PayoutAdjustmentsHistory({ implementationId }: { implementationId: string }) {
  const q = useQuery({ queryKey: ["payout-adjustments", implementationId], queryFn: () => listPayoutAdjustments(implementationId) });
  const rows = q.data ?? [];
  return <section className="rounded-xl border bg-card p-4" aria-labelledby="payout-adj-title">
    <h3 id="payout-adj-title" className="flex items-center gap-2 font-semibold"><History size={18} />Ajustes manuais de repasse</h3>
    <p className="mt-1 text-sm text-muted-foreground">Valores de reservas lançados pela equipe quando o Guia STAYO não informou.</p>
    {q.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
      : q.error ? <p className="mt-3 text-sm text-destructive">Não foi possível carregar o histórico.</p>
      : rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhum ajuste manual registrado.</p>
      : <ul className="mt-3 divide-y text-sm">{rows.map(r => <li key={r.id} className="py-2">
          <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{r.reservation_code || "Reserva"} · {PAYOUT_FIELD_LABEL[r.field]}</span>
            <span className="tabular-nums">{r.previous_missing ? "Não informado" : brl(r.previous_cents ?? 0)} → <strong>{brl(r.new_cents)}</strong></span></div>
          <div className="text-xs text-muted-foreground">{r.reason} · {r.created_by_name || "Equipe"} · {new Date(r.created_at).toLocaleString("pt-BR")} · competência {r.competence}</div>
        </li>)}</ul>}
  </section>;
}
