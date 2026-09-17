import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SearchInput,
} from "../components/data/ListStates";
import { propertiesListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/imoveis/")({
  head: () => ({
    meta: [
      { title: "Imóveis — Stayo Admin" },
      { name: "description", content: "Lista de imóveis da operação Stayo." },
      { property: "og:title", content: "Imóveis — Stayo Admin" },
      { property: "og:description", content: "Lista de imóveis da operação Stayo." },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const [q, setQ] = useState("");
  const query = useQuery(propertiesListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(term) || p.externalCode.toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Imóveis" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nome ou código" />
      </PageHeader>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={q ? "Nenhum imóvel encontrado para esta busca" : "Nenhum imóvel cadastrado ainda"}
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to="/imoveis/$id"
                  params={{ id: p.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{p.name}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>{p.externalCode}</span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {p.status}
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
