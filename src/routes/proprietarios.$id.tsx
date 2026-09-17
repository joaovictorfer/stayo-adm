import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { ownerQuery } from "../lib/api/queries";

export const Route = createFileRoute("/proprietarios/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do proprietário — Stayo Admin" },
      { name: "description", content: "Dados de contato de um proprietário Stayo." },
      { property: "og:title", content: "Detalhe do proprietário — Stayo Admin" },
      { property: "og:description", content: "Dados de contato de um proprietário Stayo." },
    ],
  }),
  component: OwnerDetailPage,
});

function OwnerDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(ownerQuery(id));
  const owner = query.data;

  return (
    <>
      <PageHeader title={owner?.name ?? "Proprietário"}>
        <Link
          to="/proprietarios"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para proprietários
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !owner ? (
        <NotFoundPanel message="Proprietário não encontrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={owner.id} />
          <Field label="Nome" value={owner.name} />
          <Field label="Telefone" value={owner.phone} />
          <Field label="E-mail" value={owner.email} />
          <Field label="Criado em" value={owner.createdAt} />
          <Field label="Atualizado em" value={owner.updatedAt} />
        </div>
      )}
    </>
  );
}
