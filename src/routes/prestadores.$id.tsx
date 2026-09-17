import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { LinkedField } from "../components/patterns/LinkedField";
import {
  operationTasksListQuery,
  serviceProviderQuery,
  settlementsListQuery,
} from "../lib/api/queries";
import { formatMoney } from "../lib/format";

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

export const Route = createFileRoute("/prestadores/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do prestador — Stayo Admin" },
      { name: "description", content: "Dados de um prestador de serviço Stayo." },
      { property: "og:title", content: "Detalhe do prestador — Stayo Admin" },
      { property: "og:description", content: "Dados de um prestador de serviço Stayo." },
    ],
  }),
  component: ProviderDetailPage,
});

function ProviderDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(serviceProviderQuery(id));
  const tasksQuery = useQuery(operationTasksListQuery());
  const settlementsQuery = useQuery(settlementsListQuery());
  const provider = query.data;

  const assignedTasks = useMemo(
    () =>
      (tasksQuery.data?.data ?? []).filter((t) => t.assignments.some((a) => a.providerId === id)),
    [tasksQuery.data, id],
  );
  const settlements = useMemo(
    () => (settlementsQuery.data?.data ?? []).filter((s) => s.providerId === id),
    [settlementsQuery.data, id],
  );

  return (
    <>
      <PageHeader title={provider?.name ?? "Prestador"}>
        <Link
          to="/prestadores"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para prestadores
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !provider ? (
        <NotFoundPanel message="Prestador não encontrado" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ID" value={provider.id} />
            <Field label="Nome" value={provider.name} />
            <Field label="Documento" value={provider.document} />
            <Field label="Chave PIX" value={provider.pixKey} />
            <Field label="Status" value={provider.active ? "Ativo" : "Inativo"} />
            <Field label="Atualizado em" value={provider.updatedAt} />
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Rotinas atribuídas
            </h2>
            {tasksQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : assignedTasks.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhuma rotina atribuída a este prestador ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {assignedTasks.map((t) => {
                  const assignment = t.assignments.find((a) => a.providerId === id);
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <LinkedField to="/operacao/$id" id={t.id} label={t.title} />
                      <span style={{ color: "var(--stayo-ink-muted)" }}>
                        {t.propertyName ?? t.propertyId ?? "—"} · {t.status}
                        {assignment ? ` · ${formatMoney(assignment.amount) ?? "—"}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Fechamentos
            </h2>
            {settlementsQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : settlements.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhum fechamento registrado para este prestador ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {settlements.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      to="/financeiro"
                      className="underline"
                      style={{ color: "var(--stayo-ink)" }}
                    >
                      {s.code}
                    </Link>
                    <span style={{ color: "var(--stayo-ink-muted)" }}>
                      {s.periodStart} → {s.periodEnd} · {s.status} · {formatMoney(s.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
