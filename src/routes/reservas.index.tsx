import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CalendarRange, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { reservationsListQuery } from "@/lib/api/queries";

export const Route = createFileRoute("/reservas/")({
  head: () => ({ meta: [
    { title: "Reservas — Stayo Admin" },
    { name: "description", content: "Carteira de reservas da operação Stayo." },
    { property: "og:title", content: "Reservas — Stayo Admin" },
    { property: "og:description", content: "Carteira de reservas da operação Stayo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: ReservationsPage,
});

type Period = "futuras" | "30dias" | "inhouse" | "arquivadas";
type State = "todos" | "chegada" | "revisao" | "pendencia";
const now = new Date().toISOString().slice(0, 10);
const plus30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const dateLabel = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${iso}T12:00:00`));

function ReservationsPage() {
  const query = useQuery(reservationsListQuery());
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("futuras");
  const [state, setState] = useState<State>("todos");
  const data = query.data?.data ?? [];
  const rows = useMemo(() => data.filter((r) => {
    const term = q.trim().toLowerCase();
    const matchesTerm = !term || [r.id, r.externalId, r.propertyName, r.channel].some((value) => value?.toLowerCase().includes(term));
    const matchesPeriod = period === "futuras" ? r.checkout >= now : period === "30dias" ? r.checkin >= now && r.checkin <= plus30 : period === "inhouse" ? r.checkin <= now && r.checkout >= now : r.checkout < now;
    const matchesState = state === "todos" || (state === "chegada" && r.checkin <= plus30) || (state === "revisao" && r.webCheckin === "pendente") || (state === "pendencia" && r.status.toLowerCase().includes("pend"));
    return matchesTerm && matchesPeriod && matchesState;
  }), [data, q, period, state]);
  const inHouse = data.filter((r) => r.checkin <= now && r.checkout >= now).length;
  const pending = data.filter((r) => r.webCheckin === "pendente").length;

  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Hospedagens" title="Reservas" description="Acompanhe estadias futuras e em andamento, em modo de leitura segura." />
    <div className="portfolio-metrics">
      <PortfolioMetric icon={CalendarRange} value={data.filter((r) => r.checkout >= now).length} label="Reservas futuras" tone="info" />
      <PortfolioMetric icon={Clock3} value={inHouse} label="Em hospedagem" tone="success" />
      <PortfolioMetric icon={CalendarDays} value={pending} label="Check-ins pendentes" tone={pending ? "warning" : "success"} />
    </div>
    <ModuleTabs value={period} onChange={setPeriod} options={[{ value: "futuras", label: "Todas futuras" }, { value: "30dias", label: "Próximos 30 dias" }, { value: "inhouse", label: "In House" }, { value: "arquivadas", label: "Arquivadas" }]} />
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
      <ModuleTabs value={state} onChange={setState} options={[{ value: "todos", label: "Todos" }, { value: "chegada", label: "Chegam em 30 dias" }, { value: "revisao", label: "Em revisão" }, { value: "pendencia", label: "Com pendência" }]} />
      <CompactSearch value={q} onChange={setQ} placeholder="Buscar imóvel, código ou canal" />
    </div>
    {query.isPending ? <div className="admin-panel p-6 text-sm text-[var(--admin-muted)]">Atualizando reservas…</div>
      : query.isError ? <div className="admin-panel"><AdminEmptyState title="Reservas indisponíveis" description="A integração não respondeu. Nenhuma reserva é exibida como confirmação." /></div>
      : rows.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={CalendarRange} title="Nenhuma reserva neste recorte" description="Altere os filtros para consultar outro período." /></div>
      : <div className="space-y-2">{rows.map((r) => <Link key={r.id} to="/reservas/$id" params={{ id: r.id }} className="reservation-card">
          <span className="reservation-date"><span><strong>{dateLabel(r.checkin).split(" ")[0]}</strong>{dateLabel(r.checkin).split(" ").slice(1).join(" ")}</span></span>
          <span className="min-w-0"><b className="block truncate text-sm">{r.propertyName ?? "Imóvel não informado"}</b><small className="block truncate text-[var(--admin-muted)]">{r.externalId ?? r.id} · {dateLabel(r.checkin)} → {dateLabel(r.checkout)}{r.channel ? ` · ${r.channel}` : ""}</small></span>
          <span className="flex flex-wrap gap-2"><AdminStatusBadge tone={r.webCheckin === "pendente" ? "warning" : "success"}>{r.webCheckin === "pendente" ? "Check-in pendente" : "Check-in concluído"}</AdminStatusBadge><AdminStatusBadge tone={r.status.toLowerCase().includes("cancel") ? "danger" : "neutral"}>{r.status}</AdminStatusBadge></span>
        </Link>)}</div>}
    <p className="text-xs text-[var(--admin-muted)]">Reservas são recebidas do STAYO APP/Core. Criação, acesso e automações permanecem na fonte oficial.</p>
  </div>;
}