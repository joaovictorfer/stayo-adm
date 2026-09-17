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
import { condominiumsListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/condominios/")({
  head: () => ({
    meta: [
      { title: "Condomínios — Stayo Admin" },
      { name: "description", content: "Lista de condomínios da operação Stayo." },
      { property: "og:title", content: "Condomínios — Stayo Admin" },
      { property: "og:description", content: "Lista de condomínios da operação Stayo." },
    ],
  }),
  component: CondominiumsPage,
});

function CondominiumsPage() {
  const [q, setQ] = useState("");
  const query = useQuery(condominiumsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (c) => c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Condomínios" count={query.isSuccess ? rows.length : undefined}>
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
              q
                ? "Nenhum condomínio encontrado para esta busca"
                : "Nenhum condomínio cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  to="/condominios/$id"
                  params={{ id: c.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {c.city ?? "—"}
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
