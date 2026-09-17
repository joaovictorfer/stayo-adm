import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building,
  CalendarCheck,
  ClipboardList,
  SquareCheck,
  Gauge,
  DollarSign,
  TrendingUp,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "../components/data/ListStates";
import { IndicatorCard, PeriodFilter } from "../components/patterns/IndicatorCard";
import {
  implementationsListQuery,
  inspectionsListQuery,
  propertiesListQuery,
  reservationsListQuery,
} from "../lib/api/queries";

export const Route = createFileRoute("/bi")({
  head: () => ({
    meta: [
      { title: "BI — Stayo Admin" },
      { name: "description", content: "Indicadores gerais da operação Stayo." },
      { property: "og:title", content: "BI — Stayo Admin" },
      { property: "og:description", content: "Indicadores gerais da operação Stayo." },
    ],
  }),
  component: BiPage,
});

type PeriodValue = "7" | "14" | "30";
const periodOptions: { value: PeriodValue; label: string }[] = [
  { value: "7", label: "7d" },
  { value: "14", label: "14d" },
  { value: "30", label: "30d" },
];

function PlaceholderCard({
  icon,
  label,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}) {
  return (
    <div
      className="rounded-[var(--radius-card)] border p-4"
      style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
          {label}
        </p>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}
        >
          {(() => {
            const Icon = icon;
            return <Icon size={15} />;
          })()}
        </span>
      </div>
      <p
        className="mt-2 text-3xl"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink-muted)" }}
      >
        —
      </p>
      <p className="mt-1 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
        sem dados — depende do Stayo Core
      </p>
    </div>
  );
}

function BiPage() {
  const [period, setPeriod] = useState<PeriodValue>("30");
  const propertiesQ = useQuery(propertiesListQuery());
  const reservationsQ = useQuery(reservationsListQuery());
  const implementationsQ = useQuery(implementationsListQuery());
  const inspectionsQ = useQuery(inspectionsListQuery());

  const reservationsInPeriod = useMemo(() => {
    const horizon = Date.now() + Number(period) * 24 * 60 * 60 * 1000;
    return (reservationsQ.data?.data ?? []).filter((r) => {
      const checkin = Date.parse(r.checkin);
      return Number.isNaN(checkin) || checkin <= horizon;
    }).length;
  }, [reservationsQ.data, period]);

  return (
    <>
      <PageHeader title="BI">
        <PeriodFilter value={period} onChange={setPeriod} options={periodOptions} />
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <IndicatorCard
          icon={Building}
          label="Imóveis cadastrados"
          value={propertiesQ.isPending ? "—" : (propertiesQ.data?.data.length ?? 0)}
        />
        <IndicatorCard
          icon={CalendarCheck}
          label={`Reservas nos próximos ${period}d`}
          value={reservationsQ.isPending ? "—" : reservationsInPeriod}
        />
        <IndicatorCard
          icon={ClipboardList}
          label="Implantações cadastradas"
          value={implementationsQ.isPending ? "—" : (implementationsQ.data?.data.length ?? 0)}
        />
        <IndicatorCard
          icon={SquareCheck}
          label="Vistorias cadastradas"
          value={inspectionsQ.isPending ? "—" : (inspectionsQ.data?.data.length ?? 0)}
        />
        <PlaceholderCard icon={Gauge} label="Ocupação" />
        <PlaceholderCard icon={DollarSign} label="Diária média" />
        <PlaceholderCard icon={TrendingUp} label="Receita por imóvel disponível" />
        <PlaceholderCard icon={Star} label="Avaliação média" />
      </div>
    </>
  );
}
