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
import { Timeline, type TimelineEntry } from "../components/patterns/Timeline";
import {
  implementationsListQuery,
  inspectionsListQuery,
  operationTasksListQuery,
  propertyQuery,
  reservationsListQuery,
} from "../lib/api/queries";
import { inspectionTypeLabels } from "../lib/inspection-types";
import type { ImplementationProject, Inspection, OperationTask, Reservation } from "../types/core";

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
  const inspectionsQ = useQuery(inspectionsListQuery());
  const reservationsQ = useQuery(reservationsListQuery());
  const tasksQ = useQuery(operationTasksListQuery());
  const implementationsQ = useQuery(implementationsListQuery());
  const property = query.data;

  const timelineLoading =
    inspectionsQ.isPending ||
    reservationsQ.isPending ||
    tasksQ.isPending ||
    implementationsQ.isPending;

  const timeline = useMemo(
    () =>
      buildPropertyTimeline(id, {
        inspections: inspectionsQ.data?.data ?? [],
        reservations: reservationsQ.data?.data ?? [],
        tasks: tasksQ.data?.data ?? [],
        implementations: implementationsQ.data?.data ?? [],
      }),
    [id, inspectionsQ.data, reservationsQ.data, tasksQ.data, implementationsQ.data],
  );

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
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ID" value={property.id} />
            <Field label="Código externo" value={property.externalCode} />
            <Field label="Nome" value={property.name} />
            <Field label="Status" value={property.status} />
            <Field
              label="Proprietário"
              value={
                property.ownerId ? (
                  <LinkedField
                    to="/proprietarios/$id"
                    id={property.ownerId}
                    label={property.ownerName}
                  />
                ) : null
              }
            />
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

          <div
            className="rounded-[var(--radius-card)] border p-4"
            style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
          >
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Linha do tempo do imóvel
            </h2>
            {timelineLoading ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : (
              <Timeline entries={timeline} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Agrega, só leitura, o que já existe em outros módulos sobre este imóvel
 * (implantação de origem, vistorias, reservas, pendências operacionais).
 * Não inventa histórico: cada entrada vem de um campo real já existente.
 */
function buildPropertyTimeline(
  propertyId: string,
  data: {
    inspections: Inspection[];
    reservations: Reservation[];
    tasks: OperationTask[];
    implementations: ImplementationProject[];
  },
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const impl of data.implementations) {
    if (impl.corePropertyId === propertyId) {
      entries.push({
        id: `impl-${impl.id}`,
        label: `Originado da implantação ${impl.code}`,
        timestamp: impl.updatedAt,
      });
    }
  }

  for (const inspection of data.inspections) {
    if (inspection.propertyId === propertyId) {
      entries.push({
        id: `insp-${inspection.id}`,
        label: `Vistoria (${inspectionTypeLabels[inspection.type]}) — ${inspection.status}`,
        timestamp: inspection.scheduledFor ?? inspection.createdAt,
      });
    }
  }

  for (const reservation of data.reservations) {
    if (reservation.propertyId === propertyId) {
      entries.push({
        id: `res-${reservation.id}`,
        label: `Reserva ${reservation.externalId ?? reservation.id}: check-in ${reservation.checkin} → check-out ${reservation.checkout}`,
        timestamp: reservation.checkin,
      });
    }
  }

  for (const task of data.tasks) {
    if (task.propertyId === propertyId) {
      entries.push({
        id: `task-${task.id}`,
        label: `${task.title} — ${task.status}`,
        timestamp: task.dueDate ?? task.createdAt,
      });
    }
  }

  return entries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
