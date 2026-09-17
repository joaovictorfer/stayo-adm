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
import { payoutsListQuery } from "../lib/api/queries";

/**
 * Financeiro — repasses por imóvel/proprietário.
 *
 * Menor privilégio: esta tela mostra apenas imóvel, reserva, canal, valor e
 * proprietário. Nenhum dado de hóspede é lido aqui, e documento/selfie não
 * existem no contrato de dados deste módulo.
 */
export const Route = createFileRoute("/financeiro/")({
  head: () => ({
    meta: [
      { title: "Financeiro — Stayo Admin" },
      { name: "description", content: "Repasses por imóvel e proprietário da operação Stayo." },
      { property: "og:title", content: "Financeiro — Stayo Admin" },
      {
        property: "og:description",
        content: "Repasses por imóvel e proprietário da operação Stayo.",
      },
    ],
  }),
  component: FinancePage,
});

function formatMoney(value: number | null, currency: string | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency ?? "BRL",
  }).format(value);
}

function FinancePage() {
  const [q, setQ] = useState("");
  const query = useQuery(payoutsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (p) =>
        (p.propertyName ?? "").toLowerCase().includes(term) ||
        (p.ownerName ?? "").toLowerCase().includes(term) ||
        (p.reservationCode ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Financeiro" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar por imóvel, proprietário ou reserva"
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
              q ? "Nenhum repasse encontrado para esta busca" : "Nenhum repasse registrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to="/financeiro/$id"
                  params={{ id: p.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{p.propertyName ?? p.propertyId ?? "—"}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {p.reservationCode ?? p.reservationId ?? "—"}
                    {p.channel ? ` · ${p.channel}` : ""}
                  </span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {p.ownerName ?? p.ownerId ?? "—"}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink)" }}>
                    {formatMoney(p.amount, p.currency)}
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
