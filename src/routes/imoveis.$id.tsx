import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { propertyQuery } from "../lib/api/queries";

export const Route = createFileRoute("/imoveis/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do imóvel — Stayo Admin" },
      { name: "description", content: "Dados de um imóvel da operação Stayo." },
      { property: "og:title", content: "Detalhe do imóvel — Stayo Admin" },
      { property: "og:description", content: "Dados de um imóvel da operação Stayo." },
    ],
  }),
  component: PropertyDetailPage,
});

function PropertyDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(propertyQuery(id));
  const property = query.data;

  return (
    <>
      <PageHeader title={property?.name ?? "Imóvel"}>
        <Link
          to="/imoveis"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para imóveis
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !property ? (
        <NotFoundPanel message="Imóvel não encontrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={property.id} />
          <Field label="Código externo" value={property.externalCode} />
          <Field label="Nome" value={property.name} />
          <Field label="Status" value={property.status} />
          <Field label="Condomínio" value={property.condominiumName} />
          <Field label="ID do condomínio" value={property.condominiumId} />
          <Field label="Unidade" value={property.unit} />
          <Field label="Cidade" value={property.city} />
          <Field label="Capacidade" value={property.capacity} />
          <Field label="Check-in" value={property.checkinTime} />
          <Field label="Check-out" value={property.checkoutTime} />
          <Field label="Criado em" value={property.createdAt} />
          <Field label="Atualizado em" value={property.updatedAt} />
        </div>
      )}
    </>
  );
}
