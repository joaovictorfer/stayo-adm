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
          <Field label="Nº de hóspedes" value={reservation.guestsCount} />
          <Field label="Status" value={reservation.status} />
          <Field label="Valor" value={reservation.amount} />
          <Field label="Criada em" value={reservation.createdAt} />
          <Field label="Atualizada em" value={reservation.updatedAt} />
        </div>
      )}
    </>
  );
}
