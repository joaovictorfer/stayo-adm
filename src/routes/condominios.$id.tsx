import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { condominiumQuery } from "../lib/api/queries";

export const Route = createFileRoute("/condominios/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do condomínio — Stayo Admin" },
      { name: "description", content: "Dados de um condomínio da operação Stayo." },
      { property: "og:title", content: "Detalhe do condomínio — Stayo Admin" },
      { property: "og:description", content: "Dados de um condomínio da operação Stayo." },
    ],
  }),
  component: CondominiumDetailPage,
});

function CondominiumDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(condominiumQuery(id));
  const condominium = query.data;

  return (
    <>
      <PageHeader title={condominium?.name ?? "Condomínio"}>
        <Link
          to="/condominios"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para condomínios
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !condominium ? (
        <NotFoundPanel message="Condomínio não encontrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={condominium.id} />
          <Field label="Nome" value={condominium.name} />
          <Field label="Cidade" value={condominium.city} />
          <Field label="Criado em" value={condominium.createdAt} />
          <Field label="Atualizado em" value={condominium.updatedAt} />
        </div>
      )}
    </>
  );
}
