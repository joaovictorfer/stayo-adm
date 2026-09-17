import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { UserCheck, Users } from "lucide-react";
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
import { serviceProvidersListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/prestadores/")({
  head: () => ({
    meta: [
      { title: "Prestadores — Stayo Admin" },
      { name: "description", content: "Prestadores de serviço da operação Stayo." },
      { property: "og:title", content: "Prestadores — Stayo Admin" },
      { property: "og:description", content: "Prestadores de serviço da operação Stayo." },
    ],
  }),
  component: ProvidersPage,
});

function ProvidersPage() {
  const [q, setQ] = useState("");
  const query = useQuery(serviceProvidersListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (p) => p.name.toLowerCase().includes(term) || (p.document ?? "").includes(term),
    );
  }, [query.data, q]);

  const active = rows.filter((p) => p.active).length;

  return (
    <>
      <PageHeader title="Prestadores" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nome ou documento" />
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <IndicatorCard icon={Users} label="Prestadores no filtro" value={rows.length} />
        <IndicatorCard icon={UserCheck} label="Ativos" value={active} />
      </div>

      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q
                ? "Nenhum prestador encontrado para esta busca"
                : "Nenhum prestador cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to="/prestadores/$id"
                  params={{ id: p.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{p.name}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>{p.document ?? "—"}</span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {p.active ? "Ativo" : "Inativo"}
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
