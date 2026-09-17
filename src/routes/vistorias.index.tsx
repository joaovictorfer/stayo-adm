import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, SquareCheck } from "lucide-react";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SelectFilter,
} from "../components/data/ListStates";
import { IndicatorCard } from "../components/patterns/IndicatorCard";
import { inspectionsListQuery } from "../lib/api/queries";
import { inspectionTypeLabels } from "../lib/inspection-types";

export const Route = createFileRoute("/vistorias/")({
  head: () => ({
    meta: [
      { title: "Vistorias — Stayo Admin" },
      { name: "description", content: "Vistorias de implantação, entrada, saída e manutenção." },
      { property: "og:title", content: "Vistorias — Stayo Admin" },
      {
        property: "og:description",
        content: "Vistorias de implantação, entrada, saída e manutenção.",
      },
    ],
  }),
  component: InspectionsPage,
});

function InspectionsPage() {
  const [type, setType] = useState("todos");
  const query = useQuery(inspectionsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    return type === "todos" ? data : data.filter((i) => i.type === type);
  }, [query.data, type]);

  const unassigned = rows.filter((i) => !i.responsibleUserId).length;

  return (
    <>
      <PageHeader title="Vistorias" count={query.isSuccess ? rows.length : undefined}>
        <SelectFilter
          label="Filtrar por tipo"
          value={type}
          onChange={setType}
          options={[
            { value: "todos", label: "Todos os tipos" },
            ...Object.entries(inspectionTypeLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <IndicatorCard icon={SquareCheck} label="Vistorias no filtro" value={rows.length} />
        <IndicatorCard
          icon={AlertTriangle}
          label="Sem responsável"
          value={unassigned}
          tone={unassigned > 0 ? "warning" : "neutral"}
        />
      </div>

      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              type === "todos"
                ? "Nenhuma vistoria registrada ainda"
                : "Nenhuma vistoria com este tipo"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((i) => (
              <li key={i.id}>
                <Link
                  to="/vistorias/$id"
                  params={{ id: i.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{inspectionTypeLabels[i.type]}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {i.propertyName ?? i.propertyId}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {i.scheduledFor ?? "—"} · {i.status}
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
