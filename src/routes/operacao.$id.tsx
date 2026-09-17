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
        </div>
      )}
    </>
  );
}
