import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
} from "../components/data/ListStates";
import { IndicatorCard, PeriodFilter } from "../components/patterns/IndicatorCard";
import { operationTasksListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/operacao/")({
  head: () => ({
    meta: [
      { title: "Operação — Stayo Admin" },
      { name: "description", content: "Pendências operacionais da rotina Stayo." },
      { property: "og:title", content: "Operação — Stayo Admin" },
      { property: "og:description", content: "Pendências operacionais da rotina Stayo." },
    ],
  }),
  component: OperationPage,
});

type PeriodValue = "7" | "14" | "30";
const periodOptions: { value: PeriodValue; label: string }[] = [
  { value: "7", label: "7d" },
  { value: "14", label: "14d" },
  { value: "30", label: "30d" },
];

function OperationPage() {
  const [period, setPeriod] = useState<PeriodValue>("7");
  const query = useQuery(operationTasksListQuery());

  const rows = useMemo(() => {
    const horizon = Date.now() + Number(period) * 24 * 60 * 60 * 1000;
    return (query.data?.data ?? []).filter((t) => {
      if (!t.dueDate) return true;
      const due = Date.parse(t.dueDate);
      return Number.isNaN(due) || due <= horizon;
    });
  }, [query.data, period]);

  const unassigned = rows.filter((t) => !t.responsibleUserId).length;

  return (
    <>
      <PageHeader title="Operação">
        <PeriodFilter value={period} onChange={setPeriod} options={periodOptions} />
      </PageHeader>
      <p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Pendências operacionais do dia a dia, considerando os próximos {period} dias.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <IndicatorCard icon={ListChecks} label="Pendências no período" value={rows.length} />
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
          <EmptyRows message="Nenhuma pendência operacional no período selecionado" />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((t) => (
              <li key={t.id}>
                <Link
                  to="/operacao/$id"
                  params={{ id: t.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{t.title}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {t.propertyName ?? t.propertyId ?? "—"}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {t.dueDate ?? "—"} · {t.status}
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
