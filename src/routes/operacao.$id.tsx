import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { operationTaskQuery } from "../lib/api/queries";
import type { OperationTaskAssignment } from "../types/core";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export const Route = createFileRoute("/operacao/$id")({
  head: () => ({
    meta: [
      { title: "Pendência operacional — Stayo Admin" },
      { name: "description", content: "Detalhe de uma pendência operacional Stayo." },
      { property: "og:title", content: "Pendência operacional — Stayo Admin" },
      { property: "og:description", content: "Detalhe de uma pendência operacional Stayo." },
    ],
  }),
  component: OperationTaskDetailPage,
});

function OperationTaskDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(operationTaskQuery(id));
  const task = query.data;

  return (
    <>
      <PageHeader title={task?.title ?? "Pendência"}>
        <Link
          to="/operacao"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para operação
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !task ? (
        <NotFoundPanel message="Pendência não encontrada" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={task.id} />
          <Field label="Título" value={task.title} />
          <Field label="Tipo" value={task.kind} />
          <Field label="Imóvel" value={task.propertyName ?? task.propertyId} />
          <Field label="Reserva" value={task.reservationId} />
          <Field label="Prazo" value={task.dueDate} />
          <Field label="Responsável" value={task.responsibleUserId} />
          <Field label="Status" value={task.status} />
          <Field label="Prioridade" value={task.priority} />
          <Field label="Criada em" value={task.createdAt} />
          <Field label="Atualizada em" value={task.updatedAt} />

          <div className="sm:col-span-2">
            <PlanningPanel totalAmount={task.totalAmount} assignments={task.assignments} />
          </div>
        </div>
      )}
    </>
  );
}

function PlanningPanel({
  totalAmount,
  assignments,
}: {
  totalAmount: number | null;
  assignments: OperationTaskAssignment[];
}) {
  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2
        className="mb-3 text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        Planejamento da rotina
      </h2>
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
        Valor total
      </p>
      <p
        className="mt-1 text-2xl"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        {formatMoney(totalAmount)}
      </p>

      {assignments.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Nenhum profissional atribuído ainda.
        </p>
      ) : (
        <ul className="mt-4 divide-y" style={{ borderColor: "var(--stayo-border)" }}>
          {assignments.map((a) => (
            <li key={a.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span style={{ color: "var(--stayo-ink)" }}>{a.userName ?? a.userId}</span>
              {a.lead && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    backgroundColor: "var(--stayo-gold-soft)",
                    color: "var(--stayo-warning)",
                  }}
                >
                  Líder
                </span>
              )}
              <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                {a.share}% · {formatMoney(a.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
