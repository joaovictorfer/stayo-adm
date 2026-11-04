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
import { operationTasksListQuery, reservationQuery } from "../lib/api/queries";
import type { OperationTask, ReservationWebCheckinStatus } from "../types/core";
import { CentralStatementPanel } from "@/components/admin/CentralStatementPanel";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

const webCheckinLabels: Record<ReservationWebCheckinStatus, string> = {
  pendente: "Ação necessária",
  concluido: "Web check-in ok",
  nao_aplicavel: "Não aplicável",
};

const webCheckinTone: Record<ReservationWebCheckinStatus, string> = {
  pendente: "var(--stayo-warning)",
  concluido: "var(--stayo-success)",
  nao_aplicavel: "var(--stayo-ink-muted)",
};

export const Route = createFileRoute("/reservas/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da reserva — Stayo Admin" },
      { name: "description", content: "Dados de uma reserva da operação Stayo." },
      { property: "og:title", content: "Detalhe da reserva — Stayo Admin" },
      { property: "og:description", content: "Dados de uma reserva da operação Stayo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservationDetailPage,
});

function ReservationDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(reservationQuery(id));
  const tasksQuery = useQuery(operationTasksListQuery());
  const reservation = query.data;

  const relatedTasks = useMemo(
    () => (tasksQuery.data?.data ?? []).filter((t) => t.reservationId === reservation?.id),
    [tasksQuery.data, reservation?.id],
  );

  return (
    <>
      <PageHeader title={reservation?.externalId ?? "Reserva"}>
        <Link
          to="/reservas"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para reservas
        </Link>
      </PageHeader>

      <CentralStatementPanel key={id} reservationId={id}/>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !reservation ? (
        <NotFoundPanel message="Reserva não encontrada" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={reservation.id} />
          <Field label="ID externo" value={reservation.externalId} />
          <Field
            label="Imóvel"
            value={
              <LinkedField
                to="/imoveis/$id"
                id={reservation.propertyId}
                label={reservation.propertyName}
              />
            }
          />
          <Field
            label="Hóspede"
            value={
              reservation.guestId ? (
                <LinkedField
                  to="/hospedes/$id"
                  id={reservation.guestId}
                  label={reservation.guestName}
                />
              ) : null
            }
          />
          <Field label="Origem" value={reservation.source} />
          <Field label="Canal" value={reservation.channel} />
          <Field label="Check-in" value={reservation.checkin} />
          <Field label="Check-out" value={reservation.checkout} />
          <Field label="Chegada prevista" value={reservation.expectedArrivalTime} />
          <Field label="Adultos" value={reservation.adultsCount} />
          <Field label="Crianças" value={reservation.childrenCount} />
          <Field label="Pets" value={reservation.petsCount} />
          <Field
            label="Web check-in"
            value={
              <span style={{ color: webCheckinTone[reservation.webCheckin] }}>
                {webCheckinLabels[reservation.webCheckin]}
              </span>
            }
          />
          <Field label="Status" value={reservation.status} />
          <Field label="Valor" value={reservation.amount} />
          <Field label="Criada em" value={reservation.createdAt} />
          <Field label="Atualizada em" value={reservation.updatedAt} />

          <div className="sm:col-span-2">
            <PropertyReadiness tasks={relatedTasks} loading={tasksQuery.isPending} />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Prontidão do imóvel para esta reserva — derivada das rotinas operacionais
 * já vinculadas a ela (`OperationTask.reservationId`), não é um status
 * separado no contrato. Falta atribuir prestador a alguma rotina vinculada
 * já basta pra não estar pronto, mesmo que as demais estejam com prestador.
 */
function PropertyReadiness({ tasks, loading }: { tasks: OperationTask[]; loading: boolean }) {
  const unassigned = tasks.filter((t) => t.assignments.length === 0);
  const ready = !loading && tasks.length > 0 && unassigned.length === 0;

  return (
    <div
      className="rounded-[var(--radius-card)] border p-4"
      style={{
        ...surface,
        borderColor: loading
          ? "var(--stayo-border)"
          : tasks.length === 0
            ? "var(--stayo-border)"
            : ready
              ? "var(--stayo-success)"
              : "var(--stayo-gold)",
      }}
    >
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
        Prontidão do imóvel
      </p>
      {loading ? (
        <p className="mt-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      ) : tasks.length === 0 ? (
        <p className="mt-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Nenhuma rotina de preparo vinculada a esta reserva ainda.
        </p>
      ) : ready ? (
        <p className="mt-1 text-sm" style={{ color: "var(--stayo-success)" }}>
          Apto pronto — todas as rotinas vinculadas têm prestador atribuído.
        </p>
      ) : (
        <p className="mt-1 text-sm" style={{ color: "var(--stayo-danger)" }}>
          Falta equipe para{" "}
          {unassigned.length === 1 ? unassigned[0]?.title : `${unassigned.length} rotinas`}.
        </p>
      )}
    </div>
  );
}
