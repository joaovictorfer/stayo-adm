import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { LinkedField } from "../components/patterns/LinkedField";
import { contractsListQuery, ownerQuery, propertiesListQuery } from "../lib/api/queries";

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

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
  const propertiesQuery = useQuery(propertiesListQuery());
  const contractsQuery = useQuery(contractsListQuery());
  const owner = query.data;

  const properties = useMemo(
    () => (propertiesQuery.data?.data ?? []).filter((p) => p.ownerId === id),
    [propertiesQuery.data, id],
  );
  const contracts = useMemo(
    () => (contractsQuery.data?.data ?? []).filter((c) => c.ownerId === id),
    [contractsQuery.data, id],
  );

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
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ID" value={owner.id} />
            <Field label="Nome" value={owner.name} />
            <Field label="Telefone" value={owner.phone} />
            <Field label="E-mail" value={owner.email} />
            <Field label="Criado em" value={owner.createdAt} />
            <Field label="Atualizado em" value={owner.updatedAt} />
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Imóveis vinculados
            </h2>
            {propertiesQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : properties.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhum imóvel vinculado a este proprietário ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {properties.map((p) => (
                  <li key={p.id}>
                    <LinkedField to="/imoveis/$id" id={p.id} label={p.name} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Contratos
            </h2>
            {contractsQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : contracts.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhum contrato vinculado a este proprietário ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {contracts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <LinkedField to="/contratos/$id" id={c.id} label={c.code} />
                    <span style={{ color: "var(--stayo-ink-muted)" }}>{c.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
