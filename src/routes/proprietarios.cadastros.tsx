import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3, FileCheck2, FilePenLine, Inbox } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { implementationsListQuery, ownerOnboardingSubmissionQuery } from "@/lib/api/queries";

export const Route = createFileRoute("/proprietarios/cadastros")({
  head: () => ({ meta: [
    { title: "Cadastros enviados — Stayo Admin" },
    { name: "description", content: "Acompanhamento seguro dos cadastros enviados por proprietários." },
    { property: "og:title", content: "Cadastros enviados — Stayo Admin" },
    { property: "og:description", content: "Acompanhamento seguro dos cadastros enviados por proprietários." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: OwnerSubmissionsPage,
});

type Filter = "aguardando" | "preenchimento" | "aprovados" | "encerrados" | "todos";
function OwnerSubmissionsPage() {
  const [filter,setFilter]=useState<Filter>("todos"); const [q,setQ]=useState("");
  const implementations=useQuery(implementationsListQuery()); const items=implementations.data?.data??[];
  const submissions=useQueries({queries:items.map((item)=>ownerOnboardingSubmissionQuery(item.id))});
  const rows=useMemo(()=>items.map((item,index)=>({item,submission:submissions[index]?.data??null,pending:submissions[index]?.isPending??false})).filter(({item,submission})=>{
    const term=q.trim().toLowerCase(); const matches=!term||[item.code,item.ownerName,item.nickname,item.condominiumName].some((v)=>v?.toLowerCase().includes(term));
    const state=!submission?"aguardando":submission.submittedAt?"aprovados":"preenchimento";
    return matches&&(filter==="todos"||filter===state||(filter==="encerrados"&&["cancelado","nao_convertido"].includes(item.status)));
  }),[items,submissions,q,filter]);
  const received=submissions.filter((entry)=>entry.data?.submittedAt).length; const filling=submissions.filter((entry)=>entry.data&&!entry.data.submittedAt).length; const waiting=Math.max(0,items.length-received-filling);
  return <div className="space-y-5"><AdminPageHeader eyebrow="Portfólio" title="Cadastros enviados" description="Acompanhe o preenchimento e abra a ficha oficial para revisar." />
    <div className="portfolio-metrics"><PortfolioMetric icon={Inbox} value={waiting} label="Aguardando" tone={waiting?"warning":"success"}/><PortfolioMetric icon={FilePenLine} value={filling} label="Em preenchimento" tone="info"/><PortfolioMetric icon={FileCheck2} value={received} label="Recebidos" tone="success"/><PortfolioMetric icon={CheckCircle2} value={items.filter((i)=>Boolean(i.ownerId)).length} label="Vinculados" tone="success"/></div>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]"><ModuleTabs value={filter} onChange={setFilter} options={[{value:"todos",label:"Todos"},{value:"aguardando",label:"Aguardando"},{value:"preenchimento",label:"Em preenchimento"},{value:"aprovados",label:"Recebidos"},{value:"encerrados",label:"Encerrados"}]} /><CompactSearch value={q} onChange={setQ} placeholder="Buscar proprietário, imóvel ou código" /></div>
    {implementations.isPending?<div className="admin-panel p-6 text-sm text-[var(--admin-muted)]">Carregando cadastros…</div>:implementations.isError?<div className="admin-panel"><AdminEmptyState title="Cadastros indisponíveis" description="Não foi possível consultar as implantações vinculadas." /></div>:rows.length===0?<div className="admin-panel"><AdminEmptyState icon={Inbox} title="Nenhum cadastro neste recorte" description="Altere os filtros para consultar outra situação." /></div>:<div className="admin-panel divide-y divide-[var(--admin-border)]">{rows.map(({item,submission,pending})=><Link key={item.id} to="/implantacao/$id" params={{id:item.id}} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-[var(--admin-surface-subtle)]"><span className="min-w-0"><b className="block truncate text-sm">{item.ownerName??"Proprietário ainda não vinculado"}</b><small className="block truncate text-[var(--admin-muted)]">{item.code} · {item.nickname??item.condominiumName??"Imóvel em definição"}{submission?.submittedAt?` · recebido em ${new Intl.DateTimeFormat("pt-BR").format(new Date(submission.submittedAt))}`:""}</small></span>{pending?<Clock3 className="size-4 text-[var(--admin-muted)]"/>:<AdminStatusBadge tone={!submission?"warning":submission.submittedAt?"success":"info"}>{!submission?"Aguardando":submission.submittedAt?"Recebido":"Em preenchimento"}</AdminStatusBadge>}</Link>)}</div>}
    <p className="text-xs text-[var(--admin-muted)]">A listagem mostra somente situação e vínculo. Dados pessoais e bancários aparecem apenas na revisão autorizada da ficha.</p></div>;
}