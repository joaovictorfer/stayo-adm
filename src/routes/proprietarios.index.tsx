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
import { ownersListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/proprietarios/")({
  head: () => ({
    meta: [
      { title: "Proprietários — Stayo Admin" },
      { name: "description", content: "Lista de proprietários da operação Stayo." },
      { property: "og:title", content: "Proprietários — Stayo Admin" },
      { property: "og:description", content: "Lista de proprietários da operação Stayo." },
    ],
  }),
  component: OwnersPage,
});

function OwnersPage() {
  const [q, setQ] = useState("");
  const query = useQuery(ownersListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (o) => o.name.toLowerCase().includes(term) || o.id.toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Proprietários" count={query.isSuccess ? rows.length : undefined}>
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
                ? "Nenhum proprietário encontrado para esta busca"
                : "Nenhum proprietário cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((o) => (
              <li key={o.id}>
                <Link
                  to="/proprietarios/$id"
                  params={{ id: o.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{o.name}</span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {o.phone ?? o.email ?? "—"}
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
