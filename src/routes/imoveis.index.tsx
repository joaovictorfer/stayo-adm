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
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";

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
      (p) => p.name.toLowerCase().includes(term) || p.externalCode.toLowerCase().includes(term),
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
            message={
              q ? "Nenhum imóvel encontrado para esta busca" : "Nenhum imóvel cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--admin-border)]">
            {rows.map((p) => (
              <li key={p.id}>
                <Link to="/imoveis/$id" params={{ id: p.id }} className="admin-data-row">
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{p.name}</strong>
                    <small className="block text-[var(--admin-muted)]">
                      {p.externalCode}
                      {p.condominiumName ? ` · ${p.condominiumName}` : ""}
                    </small>
                  </span>
                  <AdminStatusBadge
                    tone={p.status.toLowerCase() === "ativo" ? "success" : "neutral"}
                  >
                    {p.status}
                  </AdminStatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
