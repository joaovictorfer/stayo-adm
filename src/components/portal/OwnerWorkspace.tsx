import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { CircleCheck, Eye, History, LockKeyhole, Search, Wallet, ArrowUpRight, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MonthPicker } from '@/components/ui/month-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { revealOwnerGuestCpf } from '@/lib/api/core-client';
import { canRevealOwnerGuestCpf } from '@/lib/owner-workspace';
import { useOwnerSession } from '@/lib/auth/owner-session';
import type { OwnerWorkspaceSnapshot, OwnerWorkspaceReservation } from '@/types/core';

const money = (c: number | null) => c === null ? 'Não informado' : (c / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const date = (d:string) => d.slice(0,10).split('-').reverse().join('/');
const channelNames: Record<string,string> = { direta:'Diretas', airbnb:'Airbnb', booking:'Booking', decolar:'Decolar', outro:'Outras' };

export function OwnerWorkspace({ snapshot, token }: { snapshot: OwnerWorkspaceSnapshot; token?: string }) {
  const [month,setMonth] = useState(snapshot.months[0]?.competence ?? new Date().toISOString().slice(0,7));
  const [search,setSearch] = useState('');
  const [selected,setSelected] = useState<OwnerWorkspaceReservation | null>(null);
  const [cpf,setCpf] = useState<string | null>(null);
  const [revealing,setRevealing] = useState(false);
  const auth=useOwnerSession();
  const reveal=useServerFn(revealOwnerGuestCpf);
  const data=snapshot.months.find(m=>m.competence===month);
  const rows=(data?.reservations ?? []).filter(r=>`${r.guestName} ${r.code}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const channels=[...new Set(['direta','airbnb',...rows.map(r=>r.channel)])];
  const canReveal=canRevealOwnerGuestCpf(auth.account?.role,auth.status==='authenticated');
  async function showCpf() {
    if (!token || !selected) return;
    setRevealing(true);
    try { setCpf(await reveal({data:{token,reservationId:selected.id}})); } catch { toast.error('Esta conta não está autorizada a consultar o CPF deste imóvel.'); } finally { setRevealing(false); }
  }
  const metrics=[{label:'Total em reservas',value:data?.total ?? null,icon:CalendarDays},{label:'Recebido via Airbnb',value:data?.airbnbReceived ?? null,icon:CircleCheck},{label:'Repassado pela STAYO',value:data?.transferred ?? null,icon:ArrowUpRight},{label:'Saldo a receber',value:data?.balance ?? null,icon:Wallet}];
  return <div className="owner-workspace min-w-0 space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs text-muted-foreground">Atualizado em {date(snapshot.publishedAt)}</p><h2 className="mt-1 text-2xl font-semibold text-primary">Seu imóvel em números</h2></div><div className="w-full sm:w-60"><MonthPicker required value={month} onValueChange={setMonth} aria-label="Mês das reservas" /></div></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(({label,value,icon:Icon},i)=><div key={label} className={`owner-workspace-metric tone-${i}`}><Icon className="size-5"/><span className="mt-3 block text-xs">{label}</span><strong className="mt-1 block break-words font-[Outfit] text-xl tabular-nums">{money(value)}</strong></div>)}</div>
    <Tabs defaultValue="reservas"><TabsList className="h-12 w-full justify-start gap-2 bg-transparent p-0"><TabsTrigger className="gap-2" value="reservas"><CalendarDays className="size-4"/>Reservas</TabsTrigger><TabsTrigger className="gap-2" value="balancete"><Wallet className="size-4"/>Balancete</TabsTrigger><TabsTrigger className="gap-2" value="historico"><History className="size-4"/>Histórico</TabsTrigger></TabsList>
      <TabsContent value="reservas" className="mt-5 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold text-primary">Reservas do mês <span className="text-sm font-normal text-muted-foreground">({data?.reservations.length ?? 0})</span></h3><div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"/><Input className="pl-9" aria-label="Buscar reserva ou hóspede" placeholder="Buscar reserva ou hóspede" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
        {!data ? <p className="py-12 text-center text-muted-foreground">Nenhum demonstrativo publicado para este mês.</p> : <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[800px] text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['Reserva / hóspede','CPF','Período','Valor total','STAYO','Proprietário',''].map((l,i)=><th key={i} className={`px-4 py-3 font-medium ${i>=3 && i<=5?'text-right':'text-left'}`}>{l}</th>)}</tr></thead><tbody>{channels.map(channel=>{
          const items=rows.filter(r=>r.channel===channel);
          const subtotal=(key:'total'|'stayo'|'owner')=>items.some(r=>r[key]===null)?null:items.reduce((n,r)=>n+(r[key]??0),0);
          return <Group key={channel} label={channelNames[channel]??channel} channel={channel} items={items} subtotal={subtotal} onOpen={r=>{setSelected(r);setCpf(null);}}/>;
        })}</tbody></table></div>}
      </TabsContent>
      <TabsContent value="balancete" className="mt-5"><h3 className="mb-4 text-lg font-semibold text-primary">Composição do repasse</h3>{data ? <dl className="divide-y">{[['Parte do proprietário',data.ownerTotal],['Recebido via Airbnb',data.airbnbReceived],['Despesas extraordinárias',data.expenses],['Valor apurado no fechamento',data.closingAmount],['Repasses STAYO realizados',data.transferred],['Saldo a receber',data.balance]].map(([label,value],i)=><div key={String(label)} className={`flex items-center justify-between gap-4 px-3 py-4 ${i===5?'owner-workspace-balance':''}`}><dt className="text-sm">{label}</dt><dd className="shrink-0 font-semibold tabular-nums">{money(typeof value==='number'?value:null)}</dd></div>)}</dl>:<p className="py-8 text-muted-foreground">Nenhum fechamento publicado neste mês.</p>}</TabsContent>
      <TabsContent value="historico" className="mt-5"><h3 className="mb-6 text-lg font-semibold text-primary">Histórico do imóvel</h3>{snapshot.history.length===0?<p className="py-8 text-muted-foreground">Nenhuma atualização publicada até o momento.</p>:<ol className="space-y-0">{snapshot.history.map(e=><li key={e.id} className="relative ml-2 border-l pl-7 pb-7"><span className="absolute -left-2 top-1 size-4 rounded-full border-4 border-background bg-primary"/><p className="text-xs text-muted-foreground">{date(e.date)} · {e.category}</p><h4 className="mt-1 font-semibold text-primary">{e.title}</h4><span className="text-xs text-muted-foreground">{({concluido:'Concluído',completed:'Concluído',aberta:'Em acompanhamento',registrado:'Registrado'} as Record<string,string>)[e.status]??e.status}</span></li>)}</ol>}</TabsContent>
    </Tabs>
    <Dialog open={Boolean(selected)} onOpenChange={open=>{if(!open){setSelected(null);setCpf(null);}}}><DialogContent className="rounded-lg sm:max-w-xl"><DialogHeader><DialogTitle className="text-primary">{selected?.code}</DialogTitle><DialogDescription>{selected ? channelNames[selected.channel]??selected.channel : ''} · Ficha da reserva</DialogDescription></DialogHeader>{selected&&<><div className="border-b pb-4"><h3 className="text-xl font-semibold text-primary">{selected.guestName}</h3><p className="mt-2 text-sm text-muted-foreground">{date(selected.checkin)} — {date(selected.checkout)}</p></div><div className="grid grid-cols-3 gap-3 py-2">{[['Valor total',selected.total],['STAYO',selected.stayo],['Proprietário',selected.owner]].map(([l,v])=><div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p><p className="mt-2 break-words font-semibold tabular-nums">{money(typeof v==='number'?v:null)}</p></div>)}</div>{selected.directConfirmed&&<p className="flex items-center gap-2 text-sm owner-workspace-confirmed"><CircleCheck className="size-4"/>Recebimento direto confirmado · {money(selected.directReceipt)}</p>}<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div><p className="text-xs text-muted-foreground">CPF do hóspede titular</p><p className="mt-1 font-medium">{auth.status==='authenticated'?cpf??selected.cpfMasked??'Não informado':selected.cpfMasked??'Não informado'}</p></div>{token&&(canReveal?<Button variant="outline" disabled={revealing} onClick={()=>void showCpf()}><Eye className="size-4"/>{revealing?'Consultando…':'Consultar CPF'}</Button>:<Button variant="outline" asChild><Link to="/portal/login" search={{returnTo:`/portal/imovel/${token}`}}><LockKeyhole className="size-4"/>Entrar para consultar CPF</Link></Button>)}</div></>}</DialogContent></Dialog>
  </div>;
}
function Group({label,channel,items,subtotal,onOpen}:{label:string;channel:string;items:OwnerWorkspaceReservation[];subtotal:(k:'total'|'stayo'|'owner')=>number|null;onOpen:(r:OwnerWorkspaceReservation)=>void}) {
  return <><tr className={`owner-workspace-channel ${channel==='airbnb'?'is-airbnb':channel==='direta'?'is-direct':''}`}><th colSpan={7} className="px-4 py-3 text-left">{label} <span className="ml-2 text-xs font-normal">{items.length} reservas</span></th></tr>{items.map(r=><tr className="border-b" key={r.id}><td className="px-4 py-4"><strong className="block font-medium">{r.guestName}</strong><span className="text-xs text-muted-foreground">{r.code}</span></td><td className="px-4 text-xs whitespace-nowrap">{r.cpfMasked??'Não informado'}</td><td className="px-4 text-xs whitespace-nowrap">{date(r.checkin)} — {date(r.checkout)}</td>{(['total','stayo','owner'] as const).map(k=><td key={k} className="px-4 text-right tabular-nums whitespace-nowrap"><span className="inline-flex items-center gap-1">{money(r[k])}{k==='owner'&&r.directConfirmed&&<CircleCheck aria-label="Recebimento direto confirmado" className="size-4 owner-workspace-confirmed"/>}</span></td>)}<td className="px-2"><Button variant="ghost" size="icon" aria-label={`Abrir reserva ${r.code}`} onClick={()=>onOpen(r)}><ArrowUpRight className="size-4"/></Button></td></tr>)}{items.length>0&&<tr className="bg-muted/30 font-semibold"><td colSpan={3} className="px-4 py-3 text-xs">Subtotal · {label}</td>{(['total','stayo','owner'] as const).map(k=><td key={k} className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{money(subtotal(k))}</td>)}<td/></tr>}</>;
}