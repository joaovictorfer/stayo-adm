import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Building2, Clock3, Database, House, MapPin, Users } from "lucide-react";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
      <PageHeader title={property?.name ?? "Imóvel"} subtitle={property ? [property.externalCode, property.city, property.status].filter(Boolean).join(" · ") : undefined}>
        <Link
          to="/imoveis"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={15} /> Voltar
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !property ? (
        <NotFoundPanel message="Imóvel não encontrado" />
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.7fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Section title="Visão geral" icon={House}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Proprietário" value={property.ownerId ? <LinkedField to="/proprietarios/$id" id={property.ownerId} label={property.ownerName} /> : null} />
                <Field label="Condomínio" value={property.condominiumName} />
                <Field label="Unidade" value={property.unit} />
                <Field label="Cidade" value={property.city} />
                <Field label="Capacidade" value={property.capacity != null ? `${property.capacity} hóspedes` : null} />
                <Field label="Status operacional" value={property.status} />
              </div>
            </Section>
            <Section title="Rotina operacional" icon={Clock3}>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Check-in padrão" value={property.checkinTime} /><Field label="Check-out padrão" value={property.checkoutTime} /></div>
            </Section>
            <Section title="Linha do tempo" icon={Clock3}>
            {timelineLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <Timeline entries={timeline} />
            )}
            </Section>
          </div>
          <aside className="flex flex-col gap-4">
            <div className="rounded-[var(--radius-card)] bg-brand p-5 text-primary-foreground shadow-[var(--shadow-card)]">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground/10"><Building2 size={18} /></span>
              <p className="mt-4 text-xs font-semibold uppercase text-primary-foreground/60">Imóvel no portfólio</p>
              <p className="mt-1 font-display text-lg font-semibold">{property.name}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-primary-foreground/70"><MapPin size={13} />{[property.condominiumName, property.unit, property.city].filter(Boolean).join(" · ") || "Localização não informada"}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-primary-foreground/70"><Users size={13} />{property.capacity ?? "—"} hóspedes</div>
            </div>
            <Section title="Dados técnicos" icon={Database} compact>
              <div className="grid gap-3"><Field label="ID no Core" value={property.id} /><Field label="Código externo" value={property.externalCode} /><Field label="ID do condomínio" value={property.condominiumId} /><Field label="Criado em" value={property.createdAt} /><Field label="Atualizado em" value={property.updatedAt} /></div>
            </Section>
          </aside>
        </div>
      )}
    </>
  );
}

function Section({ title, icon: Icon, children, compact = false }: { title: string; icon: typeof House; children: React.ReactNode; compact?: boolean }) {
  return <section className="rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]" style={{ borderColor: "var(--stayo-border)" }}>
    <div className="flex items-center gap-2 border-b border-border px-4 py-3.5"><span className="grid h-7 w-7 place-items-center rounded-md bg-brand-soft text-brand"><Icon size={14} /></span><h2 className="font-display text-sm font-semibold">{title}</h2></div>
    <div className={compact ? "p-3" : "p-4"}>{children}</div>
  </section>;
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
