import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { reservationQuery } from "../lib/api/queries";
import type { ReservationWebCheckinStatus } from "../types/core";

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
    ],
  }),
  component: ReservationDetailPage,
});

function ReservationDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(reservationQuery(id));
  const reservation = query.data;

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
          <Field label="Imóvel" value={reservation.propertyId} />
          <Field label="Hóspede" value={reservation.guestId} />
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
        </div>
      )}
    </>
  );
}
