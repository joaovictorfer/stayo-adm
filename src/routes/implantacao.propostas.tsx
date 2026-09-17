import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { ErrorRows, ListSkeleton, PageHeader, Panel } from "../components/data/ListStates";
import { proposalsAllQuery } from "../lib/api/queries";

export const Route = createFileRoute("/implantacao/propostas")({
  head: () => ({
    meta: [
      { title: "Propostas — Stayo Admin" },
      { name: "description", content: "Versões de proposta salvas nas implantações Stayo." },
      { property: "og:title", content: "Propostas — Stayo Admin" },
      {
        property: "og:description",
        content: "Versões de proposta salvas nas implantações Stayo.",
      },
    ],
  }),
  component: ProposalsPage,
});

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ProposalsPage() {
  const query = useQuery(proposalsAllQuery());
  const proposals = query.data ?? [];

  return (
    <>
      <PageHeader title="Propostas" count={query.data ? proposals.length : undefined} />
      <p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        As propostas são editadas na aba "Proposta" dentro de cada implantação.
      </p>

      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : proposals.length === 0 ? (
          <div
            className="px-4 py-16 text-center text-sm"
            style={{ color: "var(--stayo-ink-muted)" }}
          >
            Nenhuma proposta salva ainda
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {proposals.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link
                  to="/implantacao/$id"
                  params={{ id: p.implementationId }}
                  className="text-sm underline"
                  style={{ color: "var(--stayo-forest)" }}
                >
                  Implantação {p.implementationId}
                </Link>
                <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  Versão {p.version} · {new Date(p.createdAt).toLocaleString("pt-BR")}
                </span>
                <span className="ml-auto text-sm" style={{ color: "var(--stayo-ink)" }}>
                  {currency.format(p.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
