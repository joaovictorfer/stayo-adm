import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Building2, CheckCircle2, CircleDashed, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import fallbackImage from "@/assets/owner-portal-property-fallback.jpg";
import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric, PropertyVisual } from "@/components/admin/PhaseOnePatterns";
import { propertiesListQuery } from "@/lib/api/queries";

export const Route = createFileRoute("/imoveis/")({
  head: () => ({ meta: [
    { title: "Imóveis — Stayo Admin" }, { name: "description", content: "Carteira visual de imóveis da operação Stayo." },
    { property: "og:title", content: "Imóveis — Stayo Admin" }, { property: "og:description", content: "Carteira visual de imóveis da operação Stayo." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: PropertiesPage,
});
type Filter = "todos" | "ativos" | "pendentes";
function PropertiesPage() {
  const [q, setQ] = useState(""); const [filter, setFilter] = useState<Filter>("todos");
  const query = useQuery(propertiesListQuery()); const data = query.data?.data ?? [];
  const rows = useMemo(() => data.filter((p) => {
    const term = q.trim().toLowerCase();
    return (!term || [p.name, p.externalCode, p.condominiumName, p.city].some((v) => v?.toLowerCase().includes(term))) && (filter === "todos" || (filter === "ativos" ? p.status.toLowerCase() === "ativo" : p.status.toLowerCase() !== "ativo"));
  }), [data,q,filter]);
  const active = data.filter((p) => p.status.toLowerCase() === "ativo").length;
  return <div className="space-y-5"><AdminPageHeader eyebrow="Portfólio" title="Imóveis" description="Carteira de imóveis conectados à operação STAYO." />
    <div className="portfolio-metrics"><PortfolioMetric icon={Building2} value={data.length} label="Imóveis" /><PortfolioMetric icon={CheckCircle2} value={active} label="Ativos" tone="success" /><PortfolioMetric icon={CircleDashed} value={data.length-active} label="Pendentes" tone={data.length-active ? "warning" : "success"} /></div>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]"><ModuleTabs value={filter} onChange={setFilter} options={[{value:"todos",label:"Todos"},{value:"ativos",label:"Ativos"},{value:"pendentes",label:"Pendentes"}]} /><CompactSearch value={q} onChange={setQ} placeholder="Buscar nome, código ou condomínio" /></div>
    {query.isPending ? <div className="admin-panel p-6 text-sm text-[var(--admin-muted)]">Carregando imóveis…</div> : query.isError ? <div className="admin-panel"><AdminEmptyState title="Carteira indisponível" description="Não foi possível consultar os imóveis oficiais." /></div> : rows.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={Building2} title="Nenhum imóvel encontrado" description="Altere os filtros desta carteira." /></div> : <div className="portfolio-grid">{rows.map((p) => <Link key={p.id} to="/imoveis/$id" params={{id:p.id}} className="portfolio-card"><PropertyVisual image={fallbackImage} label={p.externalCode} /><div className="portfolio-card-body"><h3>{p.name}</h3><p className="flex items-center gap-1"><MapPin className="size-3" />{p.condominiumName ?? p.city ?? "Local não informado"}</p><div className="portfolio-card-footer"><span className="truncate text-xs text-[var(--admin-muted)]">{p.capacity ? `Até ${p.capacity} hóspedes` : "Capacidade a definir"}</span><AdminStatusBadge tone={p.status.toLowerCase()==="ativo"?"success":"warning"}>{p.status}</AdminStatusBadge></div></div></Link>)}</div>}
    <p className="text-xs text-[var(--admin-muted)]">Dados de acesso, senhas e Wi-Fi não fazem parte desta consulta.</p></div>;
}