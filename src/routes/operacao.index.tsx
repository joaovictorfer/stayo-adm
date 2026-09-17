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

type ViewMode = "lista" | "agenda";
const viewOptions: { value: ViewMode; label: string }[] = [
  { value: "lista", label: "Lista" },
  { value: "agenda", label: "Agenda" },
];

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(new Date(iso));

function OperationPage() {
  const [period, setPeriod] = useState<PeriodValue>("7");
  const [view, setView] = useState<ViewMode>("lista");
  const query = useQuery(operationTasksListQuery());

  const rows = useMemo(() => {
    const horizon = Date.now() + Number(period) * 24 * 60 * 60 * 1000;
    return (query.data?.data ?? []).filter((t) => {
      if (!t.dueDate) return true;
      const due = Date.parse(t.dueDate);
      return Number.isNaN(due) || due <= horizon;
    });
  }, [query.data, period]);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const t of rows) {
      const key = t.dueDate ?? "Sem data prevista";
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    for (const [, tasks] of map) {
      tasks.sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99"));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const unassigned = rows.filter((t) => !t.responsibleUserId).length;

  return (
    <>
      <PageHeader title="Operação">
        <PeriodFilter value={view} onChange={setView} options={viewOptions} />
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

      {query.isPending ? (
        <Panel>
          <ListSkeleton />
        </Panel>
      ) : query.isError ? (
        <Panel>
          <ErrorRows onRetry={() => void query.refetch()} />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyRows message="Nenhuma pendência operacional no período selecionado" />
        </Panel>
      ) : view === "lista" ? (
        <Panel>
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
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {byDay.map(([day, tasks]) => (
            <div
              key={day}
              className="rounded-[var(--radius-card)] border"
              style={{
                borderColor: "var(--stayo-border)",
                backgroundColor: "var(--stayo-surface)",
              }}
            >
              <h2
                className="border-b px-4 py-2 text-sm capitalize"
                style={{
                  borderColor: "var(--stayo-border)",
                  fontFamily: "var(--stayo-font-display)",
                  color: "var(--stayo-ink)",
                }}
              >
                {day === "Sem data prevista" ? day : dayLabel(day)}
              </h2>
              <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                {tasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/operacao/$id"
                      params={{ id: t.id }}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                      style={{ color: "var(--stayo-ink)" }}
                    >
                      <span className="w-12 shrink-0" style={{ color: "var(--stayo-ink-muted)" }}>
                        {t.scheduledTime ?? "—"}
                      </span>
                      <span className="font-medium">{t.title}</span>
                      <span style={{ color: "var(--stayo-ink-muted)" }}>
                        {t.propertyName ?? t.propertyId ?? "—"}
                      </span>
                      <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                        {t.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
