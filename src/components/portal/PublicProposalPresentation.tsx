import { CalendarDays, CheckCircle2, FileText, ShieldCheck, Sparkles } from "lucide-react";

import type {
  CommercialProposalSnapshot,
  ProposalSnapshotCommercialTerm,
  ProposalSnapshotContractConditions,
} from "../../types/commercial-proposal";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function formatTermValue(term: ProposalSnapshotCommercialTerm): string {
  if (term.chargeType === "percentage") return `${number.format(term.value)}%`;
  if (term.chargeType === "informational" && term.value === 0) return "Informativo";
  return currency.format(term.value);
}

function contractRows(conditions: ProposalSnapshotContractConditions) {
  const rows: Array<{ label: string; value: string }> = [];

  if (conditions.administrationFee != null) {
    rows.push({ label: "Taxa de administração", value: `${number.format(conditions.administrationFee)}%` });
  }
  if (conditions.cleaningResponsibility) {
    rows.push({ label: "Responsabilidade pela limpeza", value: conditions.cleaningResponsibility });
  }
  if (conditions.payoutRule) {
    rows.push({ label: "Regra de repasse", value: conditions.payoutRule });
  }
  if (conditions.maintenanceLimit != null) {
    rows.push({ label: "Limite para manutenção", value: currency.format(conditions.maintenanceLimit) });
  }
  if (conditions.exclusivity != null) {
    rows.push({ label: "Exclusividade", value: conditions.exclusivity ? "Sim" : "Não" });
  }
  if (conditions.durationMonths != null) {
    rows.push({ label: "Prazo previsto", value: `${number.format(conditions.durationMonths)} meses` });
  }
  if (conditions.noticePeriodDays != null) {
    rows.push({ label: "Aviso prévio", value: `${number.format(conditions.noticePeriodDays)} dias` });
  }

  return rows;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--portal-border)] bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-[var(--portal-navy)] sm:text-lg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PublicProposalPresentation({
  snapshot,
}: {
  snapshot: CommercialProposalSnapshot;
}) {
  const contract = contractRows(snapshot.contractConditions);
  const terms = [...snapshot.commercialTerms].sort((a, b) => a.displayOrder - b.displayOrder);
  const content = [...snapshot.content].sort((a, b) => a.displayOrder - b.displayOrder);
  const title = snapshot.opportunity.title?.trim() || "Proposta comercial";

  return (
    <article data-testid="public-proposal-presentation" className="space-y-4 sm:space-y-5">
      <header className="overflow-hidden rounded-3xl bg-[var(--portal-navy)] px-5 py-6 text-white shadow-sm sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/70">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Proposta comercial
            </div>
            <h1 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/75">
              {snapshot.opportunity.code ? <span>{snapshot.opportunity.code}</span> : null}
              <span>Versão {snapshot.version}</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Publicada em {formatPublishedAt(snapshot.publishedAt)}
              </span>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm sm:px-5">
            <p className="text-xs uppercase tracking-[0.14em] text-white/65">Valor total</p>
            <p className="mt-1 text-2xl font-semibold sm:text-3xl">{currency.format(snapshot.total)}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4 sm:space-y-5">
          <Section title="Serviços e valores">
            {snapshot.items.length === 0 ? (
              <p className="text-sm text-[var(--portal-muted)]">Nenhum item foi incluído nesta versão.</p>
            ) : (
              <ul className="divide-y divide-[var(--portal-border)]">
                {snapshot.items.map((item, index) => (
                  <li key={`${item.description}-${index}`} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--portal-ink)]">{item.description}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--portal-muted)]">
                          {number.format(item.quantity)} × {currency.format(item.unitValue)}
                          {item.discount > 0 ? ` · desconto ${currency.format(item.discount)}` : ""}
                        </p>
                      </div>
                      <strong className="shrink-0 text-sm text-[var(--portal-navy)]">
                        {currency.format(item.total)}
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {terms.length > 0 ? (
            <Section title="Condições comerciais">
              <ul className="space-y-3">
                {terms.map((term, index) => (
                  <li
                    key={`${term.label}-${index}`}
                    className="rounded-xl bg-[var(--portal-surface-soft)] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--portal-ink)]">{term.label}</p>
                        {term.notes ? (
                          <p className="mt-1 text-sm leading-5 text-[var(--portal-muted)]">{term.notes}</p>
                        ) : null}
                        {term.optional ? (
                          <span className="mt-2 inline-block rounded-full bg-white px-2 py-1 text-[11px] font-medium text-[var(--portal-muted)]">
                            Opcional
                          </span>
                        ) : null}
                      </div>
                      <strong className="shrink-0 text-sm text-[var(--portal-navy)]">
                        {formatTermValue(term)}
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {content.length > 0 ? (
            <Section title="Como funciona">
              <div className="space-y-5">
                {content.map((block, index) => (
                  <div key={`${block.title}-${index}`}>
                    <h3 className="font-medium text-[var(--portal-ink)]">{block.title}</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--portal-muted)]">
                      {block.body}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </div>

        <aside className="space-y-4 sm:space-y-5">
          {contract.length > 0 ? (
            <Section title="Condições do contrato">
              <dl className="space-y-3">
                {contract.map((item) => (
                  <div key={item.label} className="border-b border-[var(--portal-border)] pb-3 last:border-b-0 last:pb-0">
                    <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--portal-muted)]">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm leading-5 text-[var(--portal-ink)]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          ) : null}

          {snapshot.responsibilities.length > 0 ? (
            <Section title="Responsabilidades apresentadas">
              <ul className="space-y-3">
                {snapshot.responsibilities.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-start gap-3 text-sm leading-5 text-[var(--portal-ink)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--stayo-success)]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {snapshot.requiredSignatories.length > 0 ? (
            <Section title="Partes previstas">
              <ul className="space-y-2">
                {snapshot.requiredSignatories.map((signatory, index) => (
                  <li key={`${signatory.label}-${index}`} className="flex items-center gap-2 text-sm text-[var(--portal-ink)]">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--portal-muted)]" aria-hidden="true" />
                    <span>{signatory.label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-5 text-[var(--portal-muted)]">
                Esta apresentação não registra aceite nem assinatura. O processo contratual é tratado separadamente pela Stayo.
              </p>
            </Section>
          ) : null}

          <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4 text-sm leading-6 text-[var(--portal-muted)]">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--portal-navy)]" aria-hidden="true" />
              <p>
                Este link serve somente para visualizar esta versão publicada da proposta. Ele não libera cadastro, edição, dados do imóvel ou aceite comercial.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
