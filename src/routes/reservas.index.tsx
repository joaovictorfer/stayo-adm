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
  SelectFilter,
} from "../components/data/ListStates";
import { reservationsListQuery } from "../lib/api/queries";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";

export const Route = createFileRoute("/reservas/")({
  head: () => ({
    meta: [
      { title: "Reservas — Stayo Admin" },
      { name: "description", content: "Lista de reservas da operação Stayo." },
      { property: "og:title", content: "Reservas — Stayo Admin" },
      { property: "og:description", content: "Lista de reservas da operação Stayo." },
    ],
  }),
  component: ReservationsPage,
});

function ReservationsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const query = useQuery(reservationsListQuery());

  const data = query.data?.data ?? [];

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(data.map((r) => r.status))).sort();
    return [
      { value: "all", label: "Todos os status" },
      ...unique.map((s) => ({ value: s, label: s })),
    ];
  }, [data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!term) return true;
      return r.id.toLowerCase().includes(term) || (r.externalId ?? "").toLowerCase().includes(term);
    });
  }, [data, q, status]);

  return (
    <>
      <PageHeader title="Reservas" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por código da reserva" />
        <SelectFilter
          label="Filtrar por status"
          value={status}
          onChange={setStatus}
          options={statusOptions}
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
              q || status !== "all"
                ? "Nenhuma reserva encontrada para este filtro"
                : "Nenhuma reserva cadastrada ainda"
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--admin-border)]">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to="/reservas/$id"
                  params={{ id: r.id }}
                  className="admin-data-row flex-wrap"
                >
                  <span className="min-w-44 flex-1"><strong className="block text-sm">{r.externalId ?? r.id}</strong><small className="block text-[var(--admin-muted)]">{r.propertyName ?? r.propertyId}</small></span>
                  {r.channel && (
                    <span className="text-xs text-[var(--admin-muted)]">{r.channel}</span>
                  )}
                  <span className="text-xs text-[var(--admin-muted)]">
                    {r.checkin} → {r.checkout}
                  </span>
                  <AdminStatusBadge tone={r.status.toLowerCase().includes("cancel") ? "danger" : "info"}>{r.status}</AdminStatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
