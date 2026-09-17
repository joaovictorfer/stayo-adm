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
import { guideEntriesListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/guia/")({
  head: () => ({
    meta: [
      { title: "Guia do hóspede — Stayo Admin" },
      { name: "description", content: "Administração do conteúdo editorial do Guia do hóspede." },
      { property: "og:title", content: "Guia do hóspede — Stayo Admin" },
      {
        property: "og:description",
        content: "Administração do conteúdo editorial do Guia do hóspede.",
      },
    ],
  }),
  component: GuidePage,
});

function GuidePage() {
  const [q, setQ] = useState("");
  const query = useQuery(guideEntriesListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (g) =>
        g.title.toLowerCase().includes(term) ||
        (g.category ?? "").toLowerCase().includes(term) ||
        (g.propertyName ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Guia do hóspede" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar por título, categoria ou imóvel"
        />
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
                ? "Nenhum conteúdo encontrado para esta busca"
                : "Nenhum conteúdo de guia cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((g) => (
              <li key={g.id}>
                <Link
                  to="/guia/$id"
                  params={{ id: g.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{g.title}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {g.category ?? "Sem categoria"}
                    {g.propertyName ? ` · ${g.propertyName}` : ` · ${g.scope}`}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {g.status}
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
