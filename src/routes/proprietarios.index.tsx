import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Archive, CheckCircle2, Clock3, UserRound, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { ownersListQuery } from "@/lib/api/queries";

export const Route = createFileRoute("/proprietarios/")({
  head: () => ({ meta: [
    { title: "Proprietários — Stayo Admin" }, { name: "description", content: "Gestão de proprietários e cadastros da STAYO." },
    { property: "og:title", content: "Proprietários — Stayo Admin" }, { property: "og:description", content: "Gestão de proprietários e cadastros da STAYO." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: OwnersPage,
});
type Filter = "todos"|"andamento"|"pendencias"|"arquivados";
function OwnersPage(){
  const [q,setQ]=useState(""); const [filter,setFilter]=useState<Filter>("todos"); const query=useQuery(ownersListQuery()); const data=query.data??[];
  const rows=useMemo(()=>data.filter((o)=>{const term=q.trim().toLowerCase(); const incomplete=!o.phone||!o.email||!o.document; return (!term||[o.name,o.phone,o.email].some((v)=>v?.toLowerCase().includes(term)))&&(filter==="todos"||(filter==="andamento"&&o.lifecycleStatus==="prospect")||(filter==="pendencias"&&incomplete)||(filter==="arquivados"&&o.lifecycleStatus==="inativo"));}),[data,q,filter]);
  const active=data.filter((o)=>o.lifecycleStatus==="ativo").length; const pending=data.filter((o)=>!o.phone||!o.email||!o.document).length;
  return <div className="space-y-5"><AdminPageHeader eyebrow="Portfólio" title="Gestão de Proprietários" description="Relacionamentos, cadastros e vínculos em uma visão única." />
    <div className="portfolio-metrics"><PortfolioMetric icon={UsersRound} value={data.length} label="Proprietários" /><PortfolioMetric icon={CheckCircle2} value={active} label="Ativos" tone="success" /><PortfolioMetric icon={Clock3} value={data.length-active} label="Em andamento" tone="info" /><PortfolioMetric icon={UserRound} value={pending} label="Com pendências" tone={pending?"warning":"success"} /><PortfolioMetric icon={Archive} value={data.filter((o)=>o.lifecycleStatus==="inativo").length} label="Arquivados" /></div>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]"><ModuleTabs value={filter} onChange={setFilter} options={[{value:"todos",label:"Proprietários"},{value:"andamento",label:"Em andamento"},{value:"pendencias",label:"Pendências"},{value:"arquivados",label:"Arquivados"}]} /><CompactSearch value={q} onChange={setQ} placeholder="Buscar por nome, telefone ou e-mail" /></div>
    {query.isPending?<div className="admin-panel p-6 text-sm text-[var(--admin-muted)]">Carregando proprietários…</div>:query.isError?<div className="admin-panel"><AdminEmptyState title="Proprietários indisponíveis" description="Não foi possível consultar a carteira." /></div>:rows.length===0?<div className="admin-panel"><AdminEmptyState icon={UsersRound} title="Nenhum proprietário encontrado" description="Altere a busca ou o filtro selecionado." /></div>:<div className="admin-panel divide-y divide-[var(--admin-border)]">{rows.map((o)=><Link key={o.id} to="/proprietarios/$id" params={{id:o.id}} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-[var(--admin-surface-subtle)]"><span className="grid size-10 place-items-center rounded-full bg-[var(--admin-info-soft)] font-semibold text-[var(--admin-primary)]">{o.name.slice(0,2).toUpperCase()}</span><span className="min-w-0"><b className="block truncate text-sm">{o.name}</b><small className="block truncate text-[var(--admin-muted)]">{o.phone??o.email??"Contato não informado"}</small></span><AdminStatusBadge tone={o.lifecycleStatus==="ativo"?"success":o.lifecycleStatus==="inativo"?"neutral":"warning"}>{o.lifecycleStatus==="prospect"?"Em andamento":o.lifecycleStatus}</AdminStatusBadge></Link>)}</div>}
    <p className="text-xs text-[var(--admin-muted)]">A lista não exibe CPF completo, dados bancários ou tokens de acesso.</p></div>;
}