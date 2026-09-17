import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { contractQuery } from "../lib/api/queries";

export const Route = createFileRoute("/contratos/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do contrato — Stayo Admin" },
      { name: "description", content: "Dados de um contrato da operação Stayo." },
      { property: "og:title", content: "Detalhe do contrato — Stayo Admin" },
      { property: "og:description", content: "Dados de um contrato da operação Stayo." },
    ],
  }),
  component: ContractDetailPage,
});

function ContractDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(contractQuery(id));
  const contract = query.data;

  return (
    <>
      <PageHeader title={contract?.code ?? "Contrato"}>
        <Link
          to="/contratos"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para contratos
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !contract ? (
        <NotFoundPanel message="Contrato não encontrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={contract.id} />
          <Field label="Código" value={contract.code} />
          <Field label="Proprietário" value={contract.ownerName ?? contract.ownerId} />
          <Field label="Imóvel" value={contract.propertyName ?? contract.propertyId} />
          <Field label="Tipo" value={contract.type} />
          <Field label="Status" value={contract.status} />
          <Field label="Início" value={contract.startDate} />
          <Field label="Término" value={contract.endDate} />
          <Field label="Assinado em" value={contract.signedAt} />
          <Field label="Criado em" value={contract.createdAt} />
          <Field label="Atualizado em" value={contract.updatedAt} />
        </div>
      )}
    </>
  );
}
