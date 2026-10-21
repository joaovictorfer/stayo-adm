import { createFileRoute } from "@tanstack/react-router";
import { ChargesWorkspace } from "@/components/admin/ChargesWorkspace";
export const Route = createFileRoute("/financeiro/cobrancas/$id")({head:()=>({meta:[{title:"Detalhe da cobrança — STAYO Admin"},{name:"description",content:"Revisão, publicação e histórico da cobrança STAYO."},{property:"og:title",content:"Detalhe da cobrança — STAYO Admin"},{property:"og:description",content:"Controle administrativo de demonstrativos STAYO."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Page});
function Page(){const {id}=Route.useParams();return <ChargesWorkspace key={id} mode="detail" id={id}/>;}
