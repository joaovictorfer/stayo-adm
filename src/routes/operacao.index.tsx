import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
} from "../components/data/ListStates";
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

function OperationPage() {
  const query = useQuery(operationTasksListQuery());
  const rows = query.data?.data ?? [];

  return (
    <>
      <PageHeader title="Operação" count={query.isSuccess ? rows.length : undefined} />
      <p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Pendências operacionais do dia a dia.
      </p>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows message="Nenhuma pendência operacional no momento" />
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
