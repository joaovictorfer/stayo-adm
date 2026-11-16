import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { FileText, FileWarning } from "lucide-react";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SearchInput,
} from "../components/data/ListStates";
import { IndicatorCard } from "../components/patterns/IndicatorCard";
import { contractsListQuery } from "../lib/api/queries";
import { contractsExpiringWithin } from "../lib/contract-status";

export const Route = createFileRoute("/contratos/")({
  head: () => ({
    meta: [
      { title: "Contratos — Stayo Admin" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "Contratos vinculados a proprietários e imóveis Stayo." },
      { property: "og:title", content: "Contratos — Stayo Admin" },
      {
        property: "og:description",
        content: "Contratos vinculados a proprietários e imóveis Stayo.",
      },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  const [q, setQ] = useState("");
  const query = useQuery(contractsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (c) =>
        c.code.toLowerCase().includes(term) ||
        (c.ownerName ?? "").toLowerCase().includes(term) ||
        (c.propertyName ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  const expiring = useMemo(() => contractsExpiringWithin(query.data?.data ?? [], 60), [query.data]);

  return (
    <>
      <PageHeader title="Contratos" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar por código, proprietário ou imóvel"
        />
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <IndicatorCard icon={FileText} label="Contratos no filtro" value={rows.length} />
        <IndicatorCard
          icon={FileWarning}
          label="Vencendo em 60 dias"
          value={expiring.length}
          tone={expiring.length > 0 ? "warning" : "neutral"}
        />
      </div>

      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q ? "Nenhum contrato encontrado para esta busca" : "Nenhum contrato cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  to="/contratos/$id"
                  params={{ id: c.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{c.code}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {c.ownerName ?? c.ownerId}
                    {c.propertyName ? ` · ${c.propertyName}` : ""}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
