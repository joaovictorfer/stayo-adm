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
import { guestsListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/hospedes/")({
  head: () => ({
    meta: [
      { title: "Hóspedes — Stayo Admin" },
      { name: "description", content: "Lista de hóspedes da operação Stayo." },
      { property: "og:title", content: "Hóspedes — Stayo Admin" },
      { property: "og:description", content: "Lista de hóspedes da operação Stayo." },
    ],
  }),
  component: GuestsPage,
});

function GuestsPage() {
  const [q, setQ] = useState("");
  const query = useQuery(guestsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (g) => g.name.toLowerCase().includes(term) || g.id.toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Hóspedes" count={query.isSuccess ? rows.length : undefined}>
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
              q ? "Nenhum hóspede encontrado para esta busca" : "Nenhum hóspede cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((g) => (
              <li key={g.id}>
                <Link
                  to="/hospedes/$id"
                  params={{ id: g.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {g.phone ?? g.email ?? "—"}
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
