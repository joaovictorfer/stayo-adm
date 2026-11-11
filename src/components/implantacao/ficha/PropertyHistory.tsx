import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Plus, Search, Wrench, ShoppingBag, CalendarDays, ClipboardCheck, Sparkles, Flag, Building2, ArrowUpDown, ChevronRight, Package, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { readPropertyHistory } from '@/lib/api/core-client';
import { historyCategories, historyStatuses, historyDay, historyOutstanding, type HistoryFilters } from '@/lib/property-history';
import type { PropertyHistoryEntry } from '@/types/core';
import { PropertyHistoryDialog } from './PropertyHistoryDialog';
import { PropertyHistoryExport } from './PropertyHistoryExport';

const icons = { implantacao: Building2, reserva: CalendarDays, compra: ShoppingBag, manutencao: Wrench, higienizacao: Sparkles, vistoria: ClipboardCheck, ocorrencia: Flag };
const initialFilters: HistoryFilters = { search: '', phase: '', category: '', status: '', from: '', to: '', ascending: false };
export function PropertyHistory({ implementationId, defaultPhase, property, code }: { implementationId: string; defaultPhase: 'implantacao' | 'operacao'; property: string; code: string }) {
  const read = useServerFn(readPropertyHistory);
  const [filters, setFilters] = useState<HistoryFilters>(initialFilters);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<PropertyHistoryEntry | null | undefined>(undefined);
  const q = useQuery({ queryKey: ['property-history', implementationId, filters, offset], queryFn: () => read({ data: { implementationId, filters, offset } }) });
  const set = (key: keyof HistoryFilters, value: string | boolean) => { setFilters(f => ({ ...f, [key]: value })); setOffset(0); };
  const clear = () => { setFilters(initialFilters); setOffset(0); };
  const selector = (key: 'phase' | 'category' | 'status', label: string, opts: Record<string, string>) => <div className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span><Select value={filters[key] || 'all'} onValueChange={v => set(key, v === 'all' ? '' : v)}><SelectTrigger aria-label={label} className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{Object.entries(opts).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>;
  const entries = q.data?.entries ?? [];
  const pending = q.data?.pendingEntries ?? [];
  const toCheck = pending.filter(e => historyOutstanding(e).needsCheck);
  const delivery = pending.filter(e => historyOutstanding(e).delivery > 0 || e.status === 'aguardando_entrega');
  const active = Boolean(filters.search || filters.phase || filters.category || filters.status || filters.from || filters.to);
  const dateInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  return <section className="min-w-0 text-foreground" aria-label="Histórico do imóvel">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><div><h2 className="text-xl font-semibold">Histórico do imóvel</h2><p className="mt-1 text-xs text-muted-foreground">Implantação e operação{q.data ? ` · ${q.data.total} registros neste filtro` : ''}</p></div><div className="flex flex-wrap gap-2"><PropertyHistoryExport implementationId={implementationId} property={property} code={code} from={filters.from} to={filters.to} /><Button onClick={() => setSelected(null)}><Plus className="size-4" />Registrar acontecimento</Button></div></header>
    <div className="grid gap-3 border-b py-4 sm:grid-cols-2 xl:grid-cols-3">
      <div className="relative min-w-0 sm:col-span-2 xl:col-span-3"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar no histórico" placeholder="Buscar acontecimento, responsável ou fornecedor" className="pl-9" value={filters.search} onChange={e => set('search', e.target.value)} /></div>
      {selector('phase', 'Fase', { implantacao: 'Implantação', operacao: 'Operação' })}{selector('category', 'Tipo de registro', historyCategories)}{selector('status', 'Status', { pending: 'Pendências abertas', to_check: 'Falta conferir', to_deliver: 'Falta entregar', ...historyStatuses })}
      <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">Data inicial<Input className="min-w-0" aria-label="Data inicial" type="date" value={filters.from} onChange={e => set('from', e.target.value)} /></label><label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">Data final<Input className="min-w-0" aria-label="Data final" type="date" value={filters.to} onChange={e => set('to', e.target.value)} /></label>
      <div className="flex flex-wrap items-end gap-2"><Button variant="outline" size="sm" title={filters.ascending ? 'Mais antigos primeiro' : 'Mais recentes primeiro'} aria-label="Alternar ordem" onClick={() => set('ascending', !filters.ascending)}><ArrowUpDown className="size-4" />{filters.ascending ? 'Mais antigos' : 'Mais recentes'}</Button>{active && <Button variant="ghost" size="sm" onClick={clear}><X className="size-4" />Limpar</Button>}</div>
      {dateInvalid && <p role="alert" className="text-sm text-destructive sm:col-span-2 xl:col-span-3">A data final deve ser igual ou posterior à data inicial.</p>}
    </div>
    {q.isError ? <div className="py-6"><p className="text-destructive">Não foi possível carregar o histórico.</p><Button variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button></div> : q.isLoading ? <p className="py-6 text-muted-foreground">Carregando histórico…</p> : <>
      {Boolean(q.data?.warnings.length) && <p role="alert" className="my-3 text-sm text-destructive">Histórico incompleto: falha ao consultar {q.data?.warnings.join(', ')}.</p>}
      <div className="grid gap-3 border-b py-4 sm:grid-cols-3">
        {[{ label: 'Pendências abertas', value: pending.length, icon: Flag, status: 'pending' }, { label: 'Aguardando entrega', value: delivery.length, icon: Package, status: 'to_deliver' }, { label: 'Falta conferir', value: toCheck.length, icon: ClipboardCheck, status: 'to_check' }].map(m => <Button key={m.label} variant="outline" className="h-auto justify-start gap-3 rounded-lg px-4 py-3 text-left" onClick={() => set('status', m.status)}><m.icon className="size-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block text-2xl font-semibold tabular-nums">{m.value}</span><span className="block whitespace-normal text-xs text-muted-foreground">{m.label}</span></span></Button>)}
      </div>
      <section className="border-b py-5" aria-label="O que falta conferir"><div className="mb-3 flex items-center gap-2"><ClipboardCheck className="size-4 text-primary" /><h3 className="text-sm font-semibold">O que falta conferir</h3></div>
        {toCheck.length ? <ul className="divide-y">{toCheck.map(e => { const outstanding = historyOutstanding(e); return <li key={e.id}><Button variant="ghost" className="h-auto w-full justify-start gap-3 rounded-lg py-3 text-left" onClick={() => setSelected(e)}><span className="min-w-0 flex-1"><span className="block whitespace-normal break-words text-sm font-medium">{e.title}</span><span className="mt-1 block whitespace-normal text-xs text-muted-foreground">{outstanding.checking > 0 ? `${outstanding.checking} de ${e.receivedQty} unidades recebidas ainda não conferidas` : 'Conferência pendente'}{outstanding.delivery > 0 ? ` · ${outstanding.delivery} a entregar` : ''}{e.room ? ` · ${e.room}` : ''}{e.responsible ? ` · ${e.responsible}` : ''}</span></span><ChevronRight className="size-4 shrink-0 text-primary" /></Button></li>; })}</ul> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-primary" />{q.data?.warnings.length ? 'Nenhuma conferência pendente nos registros disponíveis.' : 'Nenhuma conferência pendente neste período e tipo.'}</p>}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 py-4"><h3 className="text-sm font-semibold">Linha do tempo</h3>{entries.some(e => e.category === 'reserva') && <span className="text-xs text-muted-foreground">Reservas disponíveis no Admin · histórico parcial</span>}</div>
      {!entries.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum acontecimento neste filtro.</p>}
      <ol>{entries.map((e, i) => { const Icon = icons[e.category]; const day = historyDay(e); return <li key={e.id}>{(i === 0 || historyDay(entries[i - 1] ?? e) !== day) && <h4 className="border-b pb-2 pt-4 text-xs font-semibold text-muted-foreground">{day.split('-').reverse().join('/')}</h4>}<Button variant="ghost" className="h-auto w-full justify-start gap-3 rounded-lg py-4 text-left" onClick={() => setSelected(e)}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-primary"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{historyCategories[e.category]}</span><span>· {e.phase === 'operacao' ? 'Operação' : 'Implantação'}</span><span className="rounded-md bg-muted px-2 py-1">{historyStatuses[e.status as keyof typeof historyStatuses] ?? e.status}</span></span><span className="mt-1 block whitespace-normal break-words text-sm font-semibold">{e.title}</span>{e.description && <span className="mt-1 block line-clamp-2 whitespace-normal break-words text-xs text-muted-foreground">{e.description}</span>}<span className="mt-1 block whitespace-normal text-xs text-muted-foreground">{!e.dateOnly && `${new Date(e.occurredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })} · `}{e.responsible || e.actor}{e.room ? ` · ${e.room}` : ''}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Button></li>; })}</ol>
      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4"><Button variant="outline" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 30))}>Anterior</Button><span className="text-xs text-muted-foreground">{q.data?.total ? `${offset + 1}–${Math.min(offset + 30, q.data.total)} de ${q.data.total}` : '0 registros'}</span><Button variant="outline" disabled={offset + 30 >= (q.data?.total ?? 0)} onClick={() => setOffset(offset + 30)}>Próxima</Button></div>
    </>}
    {selected !== undefined && <PropertyHistoryDialog key={selected?.id ?? 'new'} implementationId={implementationId} entry={selected} defaultPhase={defaultPhase} onClose={() => setSelected(undefined)} />}
  </section>;
}
