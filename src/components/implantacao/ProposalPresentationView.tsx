import { formatMoney } from "../../lib/format";
import type { CommercialProposalSnapshot } from "../../types/commercial-proposal";

/**
 * Renderiza SOMENTE os campos da whitelist pública de
 * `proposal_public_resolve_by_token`. Usado na prévia interna e no link público,
 * para que a prévia mostre exatamente o que o proprietário verá.
 */
export function ProposalPresentationView({ snapshot }: { snapshot: CommercialProposalSnapshot }) {
  const c = snapshot.contractConditions ?? {};
  const conditions: Array<[string, string | null]> = [
    ["Taxa de administração", c.administrationFee != null ? `${c.administrationFee}%` : null],
    ["Limpeza", c.cleaningResponsibility ?? null],
    ["Repasse", c.payoutRule ?? null],
    ["Manutenção sem autorização", c.maintenanceLimit != null ? formatMoney(c.maintenanceLimit) : null],
    ["Vigência", c.durationMonths ? `${c.durationMonths} meses` : null],
    ["Aviso prévio", c.noticePeriodDays ? `${c.noticePeriodDays} dias` : null],
  ];
  const content = [...(snapshot.content ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <div className="space-y-5 text-sm text-[var(--stayo-ink)]">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--stayo-ink-muted)]">
          Proposta · versão {snapshot.version}
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          {snapshot.opportunity?.title || "Proposta STAYO"}
        </h2>
      </div>
      {content.map((block, i) => (
        <section key={i}>
          <h3 className="font-semibold">{block.title}</h3>
          <p className="mt-1 whitespace-pre-line text-[var(--stayo-ink-muted)]">{block.body}</p>
        </section>
      ))}
      {snapshot.items?.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Itens</h3>
          <ul className="divide-y divide-[var(--stayo-border)] rounded-[var(--radius-card)] border border-[var(--stayo-border)]">
            {snapshot.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2">
                <span>{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.description}</span>
                <span className="shrink-0 font-medium">{formatMoney(item.total)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-right font-semibold">Total: {formatMoney(snapshot.total)}</p>
        </section>
      )}
      {conditions.some(([, v]) => v) && (
        <section>
          <h3 className="mb-2 font-semibold">Condições</h3>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {conditions
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-[var(--stayo-border)] py-1.5">
                  <dt className="text-[var(--stayo-ink-muted)]">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}
      {snapshot.responsibilities?.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold">Responsabilidades</h3>
          <ul className="list-disc pl-5 text-[var(--stayo-ink-muted)]">
            {snapshot.responsibilities.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
