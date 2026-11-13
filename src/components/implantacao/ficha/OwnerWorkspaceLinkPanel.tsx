import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Copy, ExternalLink, RefreshCw, ShieldCheck, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { prepareOwnerWorkspace, publishOwnerWorkspace, listOwnerWorkspaceLinks, revokeOwnerWorkspace } from '@/lib/api/core-client';
import { OwnerWorkspace } from '@/components/portal/OwnerWorkspace';
import type { OwnerWorkspaceSnapshot } from '@/types/core';

export function OwnerWorkspaceLinkPanel({ implementationId }: { implementationId:string }) {
  const prepare=useServerFn(prepareOwnerWorkspace); const publish=useServerFn(publishOwnerWorkspace); const revoke=useServerFn(revokeOwnerWorkspace); const list=useServerFn(listOwnerWorkspaceLinks);
  const [snapshot,setSnapshot]=useState<OwnerWorkspaceSnapshot|null>(null); const [token,setToken]=useState(''); const [busy,setBusy]=useState(false);
  const links=useQuery({queryKey:['owner-workspace-links',implementationId],queryFn:()=>list({data:{implementationId}})});
  const active=links.data?.find(l=>!l.revoked_at && new Date(l.expires_at)>new Date());
  const url=token?`${window.location.origin}/portal/imovel/${token}`:'';
  async function review(){setBusy(true);try{setSnapshot(await prepare({data:{implementationId}}));}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível preparar o portal');}finally{setBusy(false);}}
  async function release(){if(!snapshot)return;setBusy(true);try{const r=await publish({data:{snapshot}});setToken(r.token);await links.refetch();toast.success('Portal publicado. O link anterior foi revogado.');}catch{toast.error('Não foi possível publicar');}finally{setBusy(false);}}
  return <div className="space-y-5"><div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4"><ShieldCheck className="size-5 shrink-0 text-primary"/><p className="text-sm text-muted-foreground">Link de leitura válido por 90 dias. Nome, reservas e valores ficam disponíveis a quem receber o link. CPF completo somente após login autorizado. Notas internas e comprovantes não são publicados.</p></div>
    {active&&<div className="flex items-center justify-between gap-3 border-b pb-4"><div className="text-sm"><strong className="block text-primary">Portal publicado</strong><span className="text-xs text-muted-foreground">Válido até {new Date(active.expires_at).toLocaleDateString('pt-BR')}</span></div><Button variant="outline" onClick={async()=>{try{await revoke({data:{id:active.id}});setToken('');await links.refetch();toast.success('Acesso revogado');}catch{toast.error('Não foi possível revogar');}}}><Ban className="size-4"/>Revogar</Button></div>}
    {token&&<div className="space-y-3"><p className="break-all rounded-lg border p-3 text-xs">{url}</p><div className="flex gap-2"><Button onClick={async()=>{try{await navigator.clipboard.writeText(url);toast.success('Link copiado');}catch{toast.error('Não foi possível copiar');}}}><Copy className="size-4"/>Copiar link</Button><Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="size-4"/>Abrir portal</a></Button></div></div>}
    <Button variant="outline" disabled={busy} onClick={()=>void review()}><RefreshCw className="size-4"/>{busy?'Preparando…':snapshot?'Atualizar prévia':'Preparar e revisar portal'}</Button>
    {snapshot&&<><div className="border-y py-4"><h3 className="font-semibold text-primary">{snapshot.propertyName}</h3><p className="mt-1 text-sm text-muted-foreground">{snapshot.months.length} meses · {snapshot.history.length} atualizações</p>{snapshot.history.length>0&&<div className="mt-4 space-y-2">{snapshot.history.map(e=><label key={e.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked onChange={()=>setSnapshot(s=>s?{...s,history:s.history.filter(h=>h.id!==e.id)}:s)}/>{e.title}</label>)}</div>}</div><OwnerWorkspace snapshot={snapshot}/><Button className="w-full" disabled={busy} onClick={()=>void release()}><ShieldCheck className="size-4"/>Publicar e gerar link dedicado</Button></>}
  </div>;
}