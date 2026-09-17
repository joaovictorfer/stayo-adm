import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { guestQuery } from "../lib/api/queries";

export const Route = createFileRoute("/hospedes/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do hóspede — Stayo Admin" },
      { name: "description", content: "Dados de contato de um hóspede da operação Stayo." },
      { property: "og:title", content: "Detalhe do hóspede — Stayo Admin" },
      {
        property: "og:description",
        content: "Dados de contato de um hóspede da operação Stayo.",
      },
    ],
  }),
  component: GuestDetailPage,
});

function GuestDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(guestQuery(id));
  const guest = query.data;

  return (
    <>
      <PageHeader title={guest?.name ?? "Hóspede"}>
        <Link
          to="/hospedes"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para hóspedes
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !guest ? (
        <NotFoundPanel message="Hóspede não encontrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={guest.id} />
          <Field label="Nome" value={guest.name} />
          <Field label="Telefone" value={guest.phone} />
          <Field label="E-mail" value={guest.email} />
          <Field label="Criado em" value={guest.createdAt} />
          <Field label="Atualizado em" value={guest.updatedAt} />
        </div>
      )}
    </>
  );
}
