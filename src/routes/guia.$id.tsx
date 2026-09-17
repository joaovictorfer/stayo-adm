import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { guideEntryQuery } from "../lib/api/queries";

export const Route = createFileRoute("/guia/$id")({
  head: () => ({
    meta: [
      { title: "Conteúdo do guia — Stayo Admin" },
      { name: "description", content: "Detalhe de um conteúdo editorial do Guia do hóspede." },
      { property: "og:title", content: "Conteúdo do guia — Stayo Admin" },
      {
        property: "og:description",
        content: "Detalhe de um conteúdo editorial do Guia do hóspede.",
      },
    ],
  }),
  component: GuideEntryDetailPage,
});

function GuideEntryDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(guideEntryQuery(id));
  const entry = query.data;

  return (
    <>
      <PageHeader title={entry?.title ?? "Conteúdo do guia"}>
        <Link to="/guia" className="text-sm underline" style={{ color: "var(--stayo-ink-muted)" }}>
          Voltar para o guia
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !entry ? (
        <NotFoundPanel message="Conteúdo não encontrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={entry.id} />
          <Field label="Título" value={entry.title} />
          <Field label="Categoria" value={entry.category} />
          <Field label="Escopo" value={entry.scope} />
          <Field label="Imóvel" value={entry.propertyName ?? entry.propertyId} />
          <Field label="Status" value={entry.status} />
          <Field label="Idioma" value={entry.language} />
          <Field label="Ordem" value={entry.order} />
          <Field label="Resumo" value={entry.summary} />
          <Field label="Criado em" value={entry.createdAt} />
          <Field label="Atualizado em" value={entry.updatedAt} />
        </div>
      )}
    </>
  );
}
