import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { LinkedField } from "../components/patterns/LinkedField";
import { StatusField } from "../components/patterns/StatusField";
import { coreApi, operationTaskQuery } from "../lib/api/queries";
import type { OperationTaskAssignment } from "../types/core";

const statusSuggestions = ["pendente", "em_andamento", "concluida", "cancelada"];

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
  const queryClient = useQueryClient();
  const query = useQuery(operationTaskQuery(id));
  const task = query.data;

  const updateStatus = useMutation({
    mutationFn: (status: string) => coreApi.operations.update(id, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operations"] });
    },
  });

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
          <Field
            label="Imóvel"
            value={
              task.propertyId ? (
                <LinkedField to="/imoveis/$id" id={task.propertyId} label={task.propertyName} />
              ) : (
                task.propertyName
              )
            }
          />
          <Field
            label="Reserva"
            value={
              task.reservationId ? <LinkedField to="/reservas/$id" id={task.reservationId} /> : null
            }
          />
          <Field label="Prazo" value={task.dueDate} />
          <Field label="Responsável" value={task.responsibleUserId} />
          <Field
            label="Status"
            value={
              <StatusField
                value={task.status}
                suggestions={statusSuggestions}
                onSave={(status) => updateStatus.mutate(status)}
                saving={updateStatus.isPending}
              />
            }
          />
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
          Nenhum prestador atribuído ainda.
        </p>
      ) : (
        <ul className="mt-4 divide-y" style={{ borderColor: "var(--stayo-border)" }}>
          {assignments.map((a) => (
            <li
              key={a.providerId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
            >
              <LinkedField
                to="/prestadores/$id"
                id={a.providerId}
                label={a.providerName ?? a.providerId}
              />
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
