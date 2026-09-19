import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Briefcase,
  Building,
  Building2,
  Calendar,
  ClipboardList,
  FileWarning,
  SquareCheck,
  Users,
} from "lucide-react";

import { IndicatorCard } from "../components/patterns/IndicatorCard";
import {
  condominiumsListQuery,
  contractsListQuery,
  guestsListQuery,
  implementationsListQuery,
  inspectionsListQuery,
  operationTasksListQuery,
  propertiesListQuery,
  reservationsListQuery,
} from "../lib/api/queries";
import { contractsExpiringWithin } from "../lib/contract-status";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Stayo Admin" },
      { name: "description", content: "Seção Dashboard do painel interno Stayo Admin." },
      { property: "og:title", content: "Dashboard — Stayo Admin" },
      { property: "og:description", content: "Seção Dashboard do painel interno Stayo Admin." },
    ],
  }),
  component: DashboardPage,
});

const todayLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date());

function DashboardPage() {
  const properties = useQuery(propertiesListQuery());
  const condominiums = useQuery(condominiumsListQuery());
  const reservations = useQuery(reservationsListQuery());
  const guests = useQuery(guestsListQuery());
  const implementations = useQuery(implementationsListQuery());
  const inspections = useQuery(inspectionsListQuery());
  const operationTasks = useQuery(operationTasksListQuery());
  const contracts = useQuery(contractsListQuery());

  const count = (q: { data?: { data: unknown[] } | undefined; isPending: boolean }) =>
    q.isPending ? "—" : (q.data?.data.length ?? 0);

  const expiringContracts = contracts.isPending
    ? []
    : contractsExpiringWithin(contracts.data?.data ?? [], 60);

  return (
    <div className="flex flex-col gap-6">
      <section
        className="rounded-[var(--radius-card)] border p-6"
        style={{
          backgroundColor: "var(--stayo-forest)",
          borderColor: "var(--stayo-forest-strong)",
        }}
      >
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-gold)" }}>
          Painel Stayo · {todayLabel}
        </p>
        <h1
          className="mt-2 text-3xl"
          style={{ fontFamily: "var(--stayo-font-display)", color: "#fdfdfb" }}
        >
          Visão geral da operação
        </h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: "rgba(253, 253, 251, 0.8)" }}>
          Resumo dos módulos do Stayo Admin. Os números refletem hoje o mock local — passam a vir do
          Stayo Core assim que a API v1 estiver disponível.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <IndicatorCard icon={Building} label="Imóveis" value={count(properties)} />
        <IndicatorCard icon={Building2} label="Condomínios" value={count(condominiums)} />
        <IndicatorCard icon={Calendar} label="Reservas" value={count(reservations)} />
        <IndicatorCard icon={Users} label="Hóspedes" value={count(guests)} />
        <IndicatorCard icon={ClipboardList} label="Implantações" value={count(implementations)} />
        <IndicatorCard icon={SquareCheck} label="Vistorias" value={count(inspections)} />
        <IndicatorCard
          icon={Briefcase}
          label="Pendências operacionais"
          value={count(operationTasks)}
        />
        <IndicatorCard
          icon={FileWarning}
          label="Contratos vencendo em 60d"
          value={contracts.isPending ? "—" : expiringContracts.length}
          tone={expiringContracts.length > 0 ? "warning" : "neutral"}
        />
      </div>
    </div>
  );
}
