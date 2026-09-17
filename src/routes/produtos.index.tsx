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
import { productsListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos e serviços — Stayo Admin" },
      { name: "description", content: "Produtos e serviços de upsell oferecidos aos hóspedes." },
      { property: "og:title", content: "Produtos e serviços — Stayo Admin" },
      {
        property: "og:description",
        content: "Produtos e serviços de upsell oferecidos aos hóspedes.",
      },
    ],
  }),
  component: ProductsPage,
});

export function formatMoney(value: number | null, currency: string | null) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency ?? "BRL",
  }).format(value);
}

function ProductsPage() {
  const [q, setQ] = useState("");
  const query = useQuery(productsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(term) || (p.category ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Produtos e serviços" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nome ou categoria" />
      </PageHeader>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q ? "Nenhum produto encontrado para esta busca" : "Nenhum produto cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to="/produtos/$id"
                  params={{ id: p.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{p.name}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {p.category ?? "Sem categoria"}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {formatMoney(p.price, p.currency) ?? "—"}
                    {p.active ? "" : " · inativo"}
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
