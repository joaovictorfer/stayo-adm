import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Calendar, FileText, Wallet } from "lucide-react";
import { useMemo } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { IndicatorCard } from "../components/patterns/IndicatorCard";
import { LinkedField } from "../components/patterns/LinkedField";
import { Timeline, type TimelineEntry } from "../components/patterns/Timeline";
import {
  contractsListQuery,
  ownerQuery,
  payoutsListQuery,
  propertiesListQuery,
  reservationsListQuery,
  serviceInvoicesListQuery,
} from "../lib/api/queries";
import { formatMoney } from "../lib/format";
import type { Contract, Reservation, ServiceInvoice } from "../types/core";

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
  const payoutsQuery = useQuery(payoutsListQuery());
  const invoicesQuery = useQuery(serviceInvoicesListQuery());
  const reservationsQuery = useQuery(reservationsListQuery());
  const owner = query.data;

  const properties = useMemo(
    () => (propertiesQuery.data?.data ?? []).filter((p) => p.ownerId === id),
    [propertiesQuery.data, id],
  );
  const contracts = useMemo(
    () => (contractsQuery.data?.data ?? []).filter((c) => c.ownerId === id),
    [contractsQuery.data, id],
  );
  const payouts = useMemo(
    () => (payoutsQuery.data?.data ?? []).filter((p) => p.ownerId === id),
    [payoutsQuery.data, id],
  );
  const invoices = useMemo(
    () => (invoicesQuery.data?.data ?? []).filter((i) => i.ownerId === id),
    [invoicesQuery.data, id],
  );
  const propertyIds = useMemo(() => new Set(properties.map((p) => p.id)), [properties]);
  const reservations = useMemo(
    () => (reservationsQuery.data?.data ?? []).filter((r) => propertyIds.has(r.propertyId)),
    [reservationsQuery.data, propertyIds],
  );
  const upcomingReservations = useMemo(() => {
    const now = Date.now();
    return reservations
      .filter((r) => Date.parse(r.checkin) >= now)
      .sort((a, b) => Date.parse(a.checkin) - Date.parse(b.checkin));
  }, [reservations]);

  const totalPayouts = payouts.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const pendingInvoices = invoices.filter((i) => !i.paidAt);
  const totalPendingInvoices = pendingInvoices.reduce((sum, i) => sum + i.total, 0);

  const timeline = useMemo(
    () => buildOwnerTimeline({ contracts, invoices, reservations }),
    [contracts, invoices, reservations],
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

          <div className="grid gap-3 sm:grid-cols-3">
            <IndicatorCard
              icon={Wallet}
              label="Total repassado"
              value={payoutsQuery.isPending ? "…" : (formatMoney(totalPayouts) ?? "—")}
            />
            <IndicatorCard
              icon={FileText}
              label="Faturas pendentes"
              value={
                invoicesQuery.isPending
                  ? "…"
                  : `${pendingInvoices.length} · ${formatMoney(totalPendingInvoices) ?? "—"}`
              }
              tone={pendingInvoices.length > 0 ? "warning" : "neutral"}
            />
            <IndicatorCard
              icon={Calendar}
              label="Próximas reservas"
              value={reservationsQuery.isPending ? "…" : upcomingReservations.length}
            />
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

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Próximas reservas
            </h2>
            {reservationsQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : upcomingReservations.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhuma reserva futura nos imóveis deste proprietário.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {upcomingReservations.map((r) => {
                  const property = properties.find((p) => p.id === r.propertyId);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <LinkedField
                        to="/reservas/$id"
                        id={r.id}
                        label={property?.name ?? r.propertyId}
                      />
                      <span style={{ color: "var(--stayo-ink-muted)" }}>
                        {r.checkin} → {r.checkout}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Linha do tempo
            </h2>
            {contractsQuery.isPending || invoicesQuery.isPending || reservationsQuery.isPending ? (
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

function buildOwnerTimeline(data: {
  contracts: Contract[];
  invoices: ServiceInvoice[];
  reservations: Reservation[];
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const contract of data.contracts) {
    if (contract.signedAt) {
      entries.push({
        id: `contract-${contract.id}`,
        label: `Contrato ${contract.code} assinado`,
        timestamp: contract.signedAt,
      });
    }
  }

  for (const invoice of data.invoices) {
    if (invoice.issuedAt) {
      entries.push({
        id: `invoice-issued-${invoice.id}`,
        label: `Fatura ${invoice.code} emitida — ${invoice.title}`,
        timestamp: invoice.issuedAt,
      });
    }
    if (invoice.paidAt) {
      entries.push({
        id: `invoice-paid-${invoice.id}`,
        label: `Fatura ${invoice.code} paga`,
        timestamp: invoice.paidAt,
      });
    }
  }

  for (const reservation of data.reservations) {
    entries.push({
      id: `res-${reservation.id}`,
      label: `Reserva ${reservation.externalId ?? reservation.id}: check-in ${reservation.checkin} → check-out ${reservation.checkout}`,
      timestamp: reservation.checkin,
    });
  }

  return entries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
