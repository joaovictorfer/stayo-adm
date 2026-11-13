import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { LockKeyhole } from 'lucide-react';
import { readOwnerWorkspace } from '@/lib/api/core-client';
import { PortalShell, PortalSkeleton, PortalEmptyState } from '@/components/portal/PortalExperience';
import { OwnerWorkspace } from '@/components/portal/OwnerWorkspace';
import { StayoLogo } from '@/components/brand/StayoLogo';
import fallback from '@/assets/owner-portal-property-fallback.jpg';

export const Route=createFileRoute('/portal/imovel/$token')({head:()=>({meta:[{title:'Seu imóvel e repasses — Portal STAYO'},{name:'description',content:'Acompanhamento privado de reservas, balancetes e histórico do seu imóvel.'},{property:'og:title',content:'Seu imóvel e repasses — Portal STAYO'},{property:'og:description',content:'Acompanhe seu imóvel com acesso dedicado e informações publicadas pela STAYO.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex, nofollow, noarchive'},{name:'referrer',content:'no-referrer'}]}),component:Page});
function Page(){
  const {token}=Route.useParams(); const read=useServerFn(readOwnerWorkspace);
  const q=useQuery({queryKey:['owner-workspace',token],queryFn:()=>read({data:{token}}),retry:false,staleTime:0,gcTime:0});
  return <PortalShell showBrand={false} framed={false} footer="Portal do Proprietário · STAYO Gramado">{q.isPending?<PortalSkeleton/>:q.isError||!q.data?<PortalEmptyState icon={<LockKeyhole/>} title="Acesso indisponível" description="Este link expirou, foi revogado ou não está disponível. Solicite um novo link à equipe STAYO."/>:<><header className="owner-workspace-header"><img src={q.data.coverUrl??fallback} alt={q.data.propertyName} className="owner-workspace-cover"/><div className="owner-workspace-header-copy"><StayoLogo variant="white" className="w-28"/><p className="mt-6 text-xs">Portal do Proprietário · {q.data.code}</p><h1 className="mt-2 text-3xl font-semibold">{q.data.propertyName}</h1><span className="mt-3 inline-block text-sm">{q.data.situation==='operacao'?'Em operação':q.data.situation==='implantacao'?'Em implantação':'Acompanhamento do imóvel'}</span></div></header><div className="mt-6"><OwnerWorkspace snapshot={q.data} token={token}/></div></>}</PortalShell>;
}