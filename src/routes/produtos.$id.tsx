import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { productQuery } from "../lib/api/queries";

export const Route = createFileRoute("/produtos/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do produto — Stayo Admin" },
      { name: "description", content: "Dados de um produto ou serviço de upsell." },
      { property: "og:title", content: "Detalhe do produto — Stayo Admin" },
      { property: "og:description", content: "Dados de um produto ou serviço de upsell." },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(productQuery(id));
  const product = query.data;

  return (
    <>
      <PageHeader title={product?.name ?? "Produto"}>
        <Link
          to="/produtos"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para produtos
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !product ? (
        <NotFoundPanel message="Produto não encontrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={product.id} />
          <Field label="Nome" value={product.name} />
          <Field label="Categoria" value={product.category} />
          <Field label="Descrição" value={product.description} />
          <Field label="Preço" value={product.price} />
          <Field label="Moeda" value={product.currency} />
          <Field label="Unidade" value={product.unit} />
          <Field label="Ativo" value={product.active ? "Sim" : "Não"} />
          <Field label="Criado em" value={product.createdAt} />
          <Field label="Atualizado em" value={product.updatedAt} />
        </div>
      )}
    </>
  );
}
