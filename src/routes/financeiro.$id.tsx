import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { payoutQuery } from "../lib/api/queries";

/** Menor privilégio: sem dados de hóspede, nunca documento ou selfie. */
export const Route = createFileRoute("/financeiro/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do repasse — Stayo Admin" },
      { name: "description", content: "Dados de um repasse por imóvel e proprietário." },
      { property: "og:title", content: "Detalhe do repasse — Stayo Admin" },
      { property: "og:description", content: "Dados de um repasse por imóvel e proprietário." },
    ],
  }),
  component: PayoutDetailPage,
});

function PayoutDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(payoutQuery(id));
  const payout = query.data;

  return (
    <>
      <PageHeader title="Repasse">
        <Link
          to="/financeiro"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para financeiro
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !payout ? (
        <NotFoundPanel message="Repasse não encontrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={payout.id} />
          <Field label="Imóvel" value={payout.propertyName ?? payout.propertyId} />
          <Field label="Reserva" value={payout.reservationCode ?? payout.reservationId} />
          <Field label="Canal" value={payout.channel} />
          <Field label="Valor" value={payout.amount} />
          <Field label="Moeda" value={payout.currency} />
          <Field label="Proprietário" value={payout.ownerName ?? payout.ownerId} />
        </div>
      )}
    </>
  );
}
