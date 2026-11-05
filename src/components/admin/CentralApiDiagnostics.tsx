import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldCheck, RefreshCw, PlugZap, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminEmptyState, AdminStatusBadge } from "./AdminPrimitives";
import { centralDiagnostics, testCentralConnection, anonymousCentralProbe, anonymousCentralProbeEligibility } from "@/lib/stayo-central/central.functions";
import { messages, type CentralErrorKind } from "@/lib/stayo-central/contracts";
import type { MappingRow } from "@/lib/stayo-central/mapping";
const labels:Record<MappingRow["state"],string>={matched_uuid:"UUID correspondente",local_unlinked:"Sem UUID externo",external_unlinked:"Sem vínculo local",duplicate_external:"Conferência necessária",external_not_returned:"Origem ainda não consultada"};
function AnonymousProbe(){
 const probe=useServerFn(anonymousCentralProbe);const elig=useServerFn(anonymousCentralProbeEligibility);
 const e=useQuery({queryKey:["central-anon-probe-eligibility"],queryFn:()=>elig(),retry:false});
 const [busy,setBusy]=useState(false);const [res,setRes]=useState<Awaited<ReturnType<typeof probe>>|null>(null);const [err,setErr]=useState("");
 const eligible=e.data?.eligible===true;
 async function run(){setBusy(true);setErr("");setRes(null);try{setRes(await probe());}catch(x){setErr((x as Error).message||"Falha no diagnóstico.");}finally{setBusy(false);}}
 return <section className="border-y border-border py-4 space-y-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold">Diagnóstico anônimo</h3><p className="text-muted-foreground">{eligible?"Disponível somente neste preview":"Desativado neste ambiente"}</p></div><Button variant="outline" disabled={!eligible||busy} onClick={run}>{busy?"Verificando…":"Verificar acesso à API sem token"}</Button></div>
 {err&&<p role="alert" className="text-destructive">{err}</p>}
 {res&&<dl className="grid gap-1" role="status"><div>Projeto: {res.project} · Ambiente: {res.environment}</div><div>Horário: {new Date(res.executedAt).toLocaleString("pt-BR")} · Execução: {res.executionId}</div><div className="font-medium">{res.ok?"Conectividade anônima comprovada":"Falha na conectividade"}</div>{res.calls.map(c=><div key={c.name}>{c.name}: {c.ok?"OK":"falha"+(c.failure?` (${c.failure})`:"")} · HTTP {c.status??"—"} · request ID {c.requestId??"—"}</div>)}</dl>}</section>;
}
export function CentralApiDiagnostics(){
 const read=useServerFn(centralDiagnostics);const test=useServerFn(testCentralConnection);
 const q=useQuery({queryKey:["central-api-diagnostics"],queryFn:()=>read(),retry:false});
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
 if(q.isPending)return <div className="space-y-3 py-6" role="status" aria-label="Carregando diagnóstico">{[1,2,3].map(n=><div key={n} className="h-6 bg-muted rounded animate-pulse"/>)}</div>;
 if(q.isError||!q.data)return <AdminEmptyState title="Diagnóstico restrito ou indisponível" description="Somente administradores autorizados podem acessar esta integração." action={<Button variant="outline" onClick={()=>q.refetch()}><RefreshCw/>Tentar novamente</Button>}/>;
 const d=q.data;const attempt=d.lastAttempt;const kind=attempt?.result_kind as CentralErrorKind|undefined;
 async function run(){setBusy(true);try{const result=await test();setNotice(result.message);await q.refetch();}catch{setNotice("Não foi possível consultar a conexão.");}finally{setBusy(false);}}
 return <section className="py-4 space-y-7">
  <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 mb-2"><ShieldCheck className="text-primary" size={20}/><h2 className="text-xl font-semibold">API Central STAYO</h2></div><AdminStatusBadge tone="warning">{!d.originValid?"Configuração inválida":d.configured?"Conexão desativada":"Integração ainda não configurada"}</AdminStatusBadge></div><Button variant="outline" disabled={!d.connectionEnabled||!d.configured||!d.originValid||busy} onClick={run}><PlugZap/>{busy?"Consultando…":"Testar conexão"}</Button></header>
  <dl className="grid gap-4 sm:grid-cols-2 text-sm"><div><dt className="text-muted-foreground">Provedor oficial</dt><dd className="mt-1 break-all">{d.baseUrl}</dd></div><div><dt className="text-muted-foreground">Aplicação / escopo solicitado</dt><dd className="mt-1">stayo-admin · admin:read</dd></div><div><dt className="text-muted-foreground">Credencial</dt><dd className="mt-1">{d.configured?"Configurada no servidor; conexão não autorizada":"Emissão oficial pendente"}</dd></div><div><dt className="text-muted-foreground">Contrato conferido</dt><dd className="mt-1">STAYO App · revisão {d.contractRevision}</dd></div><div><dt className="text-muted-foreground">Última consulta bem-sucedida</dt><dd className="mt-1">{d.lastSuccess?new Date(d.lastSuccess.queried_at).toLocaleString("pt-BR"):"Nenhuma consulta homologada"}</dd></div><div><dt className="text-muted-foreground">Registros retornados</dt><dd className="mt-1">{d.lastSuccess?.returned_count??"Não consultados"}</dd></div></dl>
  {(notice||kind)&&<p role="status" className="text-sm text-muted-foreground">{notice||(kind?messages[kind]:"")}{attempt?.http_status?` · HTTP ${attempt.http_status}`:""}</p>}
  <AnonymousProbe/>
  <div className="flex items-center gap-2 border-y border-border py-4 text-sm text-muted-foreground"><LockKeyhole size={18}/><span>Importação e eventos desativados · nenhum cadastro alterado</span></div>
  <section><h3 className="text-base font-semibold mb-3">Correspondência dos cadastros locais</h3><p className="text-sm text-muted-foreground mb-4">{d.mapping.counts.localOwners} proprietários · {d.mapping.counts.localProperties} implantações · {d.mapping.counts.ambiguous} divergências de vínculo</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b border-border"><th className="p-2 font-medium">Origem local</th><th className="p-2 font-medium">UUID externo</th><th className="p-2 font-medium">Situação</th></tr></thead><tbody>{[...d.mapping.owners.map(r=>({...r,label:"Proprietário"})),...d.mapping.properties.map(r=>({...r,label:r.commercialCode||"Implantação"}))].map((r,i)=><tr key={`${r.localId}-${i}`} className="border-b border-border"><td className="p-2"><span className="block">{r.label}</span><span className="text-xs text-muted-foreground break-all">{r.localId}</span></td><td className="p-2 text-xs break-all">{r.externalId||"—"}</td><td className="p-2">{labels[r.state]}</td></tr>)}</tbody></table></div>{d.mapping.ownerReferenceConflicts.length>0&&<ul className="mt-4 text-sm text-destructive">{d.mapping.ownerReferenceConflicts.map(p=><li key={p.localId}>{p.code}: referências de proprietário divergentes entre cadastro e implantação.</li>)}</ul>}</section>
 </section>;
}