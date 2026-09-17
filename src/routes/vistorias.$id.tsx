import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { ComponentType } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { inspectionQuery } from "../lib/api/queries";
import { inspectionTypeLabels } from "../lib/inspection-types";

export const Route = createFileRoute("/vistorias/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da vistoria — Stayo Admin" },
      { name: "description", content: "Dados de uma vistoria da operação Stayo." },
      { property: "og:title", content: "Detalhe da vistoria — Stayo Admin" },
      { property: "og:description", content: "Dados de uma vistoria da operação Stayo." },
    ],
  }),
  component: InspectionDetailPage,
});

function InspectionDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(inspectionQuery(id));
  const inspection = query.data;

  return (
    <>
      <PageHeader title={inspection ? inspectionTypeLabels[inspection.type] : "Vistoria"}>
        <Link
          to="/vistorias"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para vistorias
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !inspection ? (
        <NotFoundPanel message="Vistoria não encontrada" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={inspection.id} />
          <Field label="Tipo" value={inspectionTypeLabels[inspection.type]} />
          <Field
            label="Imóvel"
            value={
              <LinkedField
                to="/imoveis/$id"
                id={inspection.propertyId}
                label={inspection.propertyName}
              />
            }
          />
          <Field
            label="Implantação vinculada"
            value={
              inspection.implementationId ? (
                <LinkedField to="/implantacao/$id" id={inspection.implementationId} />
              ) : null
            }
          />
          <Field
            label="Reserva vinculada"
            value={
              inspection.reservationId ? (
                <LinkedField to="/reservas/$id" id={inspection.reservationId} />
              ) : null
            }
          />
          <Field label="Agendada para" value={inspection.scheduledFor} />
          <Field label="Responsável" value={inspection.responsibleUserId} />
          <Field label="Status" value={inspection.status} />
          <Field label="Observação" value={inspection.notes} />
          <Field label="Criada em" value={inspection.createdAt} />
          <Field label="Atualizada em" value={inspection.updatedAt} />
        </div>
      )}
    </>
  );
}

/** `to` vem de dados de configuração/relacionamento, então usamos o Link com tipagem solta. */
const DynamicLink = Link as unknown as ComponentType<{
  to: string;
  params: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}>;

function LinkedField({ to, id, label }: { to: string; id: string; label?: string | null }) {
  return (
    <DynamicLink
      to={to}
      params={{ id }}
      className="underline"
      style={{ color: "var(--stayo-forest)" }}
    >
      {label ?? id}
    </DynamicLink>
  );
}
