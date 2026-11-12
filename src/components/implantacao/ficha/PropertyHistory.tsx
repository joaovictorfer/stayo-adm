import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Plus, Search, Wrench, ShoppingBag, CalendarDays, ClipboardCheck, Sparkles, Flag, Building2, ArrowUpDown, ChevronRight, ChevronDown, SlidersHorizontal, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { readPropertyHistory, recordPropertyHistory } from '@/lib/api/core-client';
import { historyCategories, historyStatuses, historyDay, historyOutstanding, validateHistoryQuantities, type HistoryFilters } from '@/lib/property-history';
import type { PropertyHistoryEntry } from '@/types/core';
import { PropertyHistoryDialog } from './PropertyHistoryDialog';
import { PropertyHistoryExport } from './PropertyHistoryExport';
import { PropertyTimelineChecklist } from './PropertyTimelineChecklist';

const icons = { implantacao: Building2, reserva: CalendarDays, compra: ShoppingBag, manutencao: Wrench, higienizacao: Sparkles, vistoria: ClipboardCheck, ocorrencia: Flag };
const initialFilters: HistoryFilters = { search: '', phase: '', category: '', status: '', from: '', to: '', ascending: false };
export function PropertyHistory({ implementationId, defaultPhase, property, code }: { implementationId: string; defaultPhase: 'implantacao' | 'operacao'; property: string; code: string }) {
  const read = useServerFn(readPropertyHistory);
  const save = useServerFn(recordPropertyHistory);
  const qc = useQueryClient();
  const [filters, setFilters] = useState<HistoryFilters>(initialFilters);
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<PropertyHistoryEntry | null | undefined>(undefined);
  const q = useQuery({ queryKey: ['property-history', implementationId, filters, offset], queryFn: () => read({ data: { implementationId, filters, offset } }) });
  const set = (key: keyof HistoryFilters, value: string | boolean) => { setFilters(f => ({ ...f, [key]: value })); setOffset(0); setShowActivity(true); };
  const clear = () => { setFilters(initialFilters); setOffset(0); };
  const selector = (key: 'phase' | 'category' | 'status', label: string, opts: Record<string, string>) => <div className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span><Select value={filters[key] || 'all'} onValueChange={v => set(key, v === 'all' ? '' : v)}><SelectTrigger aria-label={label} className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{Object.entries(opts).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>;
  const entries = q.data?.entries ?? [];
  const pending = q.data?.pendingEntries ?? [];
  const active = Boolean(filters.search || filters.phase || filters.category || filters.status || filters.from || filters.to);
  const dateInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  async function complete(entry: PropertyHistoryEntry) {
    if (busy || !entry.caseId) return;
    setBusy(entry.id);
    try {
      const current = await read({ data: { implementationId, caseId: entry.caseId, filters: initialFilters, offset: 0 } });
      const latest = current.entries[0];
      if (current.warnings.length || !latest) throw new Error('Não foi possível conferir a versão atual. Tente novamente.');
      if (latest.revision !== entry.revision) throw new Error('Este acontecimento foi atualizado. Confira a versão mais recente.');
      const error = validateHistoryQuantities(latest.category, 'concluido', latest.expectedQty, latest.receivedQty, latest.checkedQty);
      if (error) { toast.info(error); setSelected(latest); return; }
      await save({ data: { implementation_id: implementationId, case_id: latest.caseId, revision: latest.revision, request_id: crypto.randomUUID(), title: latest.title, category: latest.category, phase: latest.phase, status: 'concluido', occurred_at: new Date().toISOString(), date_only: false, description: 'Conclusão marcada na linha do tempo.', responsible: latest.responsible, room: latest.room, supplier: latest.supplier, expected_qty: latest.expectedQty, received_qty: latest.receivedQty, checked_qty: latest.checkedQty, expected_date: latest.expectedDate, amount_cents: latest.amountCents, is_correction: false, correction_reason: '' } });
      toast.success('Acontecimento concluído');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível concluir.'); }
    finally { await Promise.all([qc.invalidateQueries({ queryKey: ['property-history', implementationId] }), qc.invalidateQueries({ queryKey: ['property-history-case'] })]); setBusy(null); }
  }
  return <section className="min-w-0 text-foreground" aria-label="Histórico do imóvel">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><h2 className="text-xl font-semibold">Histórico do imóvel</h2><div className="flex flex-wrap gap-2"><PropertyHistoryExport implementationId={implementationId} property={property} code={code} from={filters.from} to={filters.to} /><Button onClick={() => setSelected(null)}><Plus className="size-4" />Novo registro</Button></div></header>
    <PropertyTimelineChecklist implementationId={implementationId} />
    {q.isError ? <div className="py-6"><p className="text-destructive">Não foi possível carregar o histórico.</p><Button variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button></div> : q.isLoading ? <p className="py-6 text-muted-foreground">Carregando histórico…</p> : <>
      {Boolean(q.data?.warnings.length) && <p role="alert" className="my-3 text-sm text-destructive">Histórico incompleto: falha ao consultar {q.data?.warnings.join(', ')}.</p>}
      {pending.length > 0 && <section className="border-b py-5" aria-label="Acontecimentos pendentes"><h3 className="mb-3 text-sm font-semibold">Acontecimentos pendentes <span className="ml-1 text-muted-foreground">({pending.length})</span></h3><ul className="divide-y">{pending.map(e => {
        const outstanding = historyOutstanding(e);
        const canComplete = Boolean(e.caseId) && !validateHistoryQuantities(e.category, 'concluido', e.expectedQty, e.receivedQty, e.checkedQty);
        return <li key={e.id} className="flex items-center gap-2 py-2"><Button variant="ghost" className="h-auto min-h-12 min-w-0 flex-1 justify-start gap-3 px-2 py-2 text-left" onClick={() => setSelected(e)}><span className="min-w-0 flex-1"><span className="block whitespace-normal break-words text-sm font-medium">{e.title}</span><span className="mt-1 block whitespace-normal text-xs text-muted-foreground">{historyStatuses[e.status as keyof typeof historyStatuses] ?? e.status}{outstanding.delivery > 0 ? ` · ${outstanding.delivery} a entregar` : ''}{outstanding.checking > 0 ? ` · ${outstanding.checking} a conferir` : ''}{e.room ? ` · ${e.room}` : ''}</span></span></Button><Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => canComplete ? void complete(e) : setSelected(e)}>{busy === e.id ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : canComplete ? <Check className="size-4" /> : <ClipboardCheck className="size-4" />}{canComplete ? 'Concluir' : 'Conferir'}</Button></li>;
      })}</ul></section>}
      <div className="flex flex-wrap items-center justify-between gap-2 py-4"><Button variant="ghost" className="justify-start px-0 font-semibold" aria-expanded={showActivity || active} onClick={() => setShowActivity(!showActivity)}><ChevronDown className={`size-4 ${showActivity || active ? 'rotate-180' : ''}`} />Atividades anteriores <span className="text-xs font-normal text-muted-foreground">({q.data?.total ?? 0})</span></Button><Button variant={showFilters ? 'secondary' : 'ghost'} size="sm" aria-expanded={showFilters} onClick={() => { setShowFilters(!showFilters); setShowActivity(true); }}><SlidersHorizontal className="size-4" />Filtros{active && <span className="size-1.5 rounded-full bg-primary" />}</Button></div>
      {showFilters && <div className="grid gap-3 border-b pb-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="relative min-w-0 sm:col-span-2 xl:col-span-3"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar no histórico" placeholder="Buscar acontecimento" className="pl-9" value={filters.search} onChange={e => set('search', e.target.value)} /></div>
        {selector('phase', 'Fase', { implantacao: 'Implantação', operacao: 'Operação' })}{selector('category', 'Tipo de registro', historyCategories)}{selector('status', 'Status', { pending: 'Pendências abertas', to_check: 'Falta conferir', to_deliver: 'Falta entregar', ...historyStatuses })}
        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">Data inicial<Input className="min-w-0" aria-label="Data inicial" type="date" value={filters.from} onChange={e => set('from', e.target.value)} /></label><label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">Data final<Input className="min-w-0" aria-label="Data final" type="date" value={filters.to} onChange={e => set('to', e.target.value)} /></label>
        <div className="flex flex-wrap items-end gap-2"><Button variant="outline" size="sm" aria-label="Alternar ordem" onClick={() => set('ascending', !filters.ascending)}><ArrowUpDown className="size-4" />{filters.ascending ? 'Mais antigos' : 'Mais recentes'}</Button>{active && <Button variant="ghost" size="sm" onClick={clear}><X className="size-4" />Limpar</Button>}</div>
        {dateInvalid && <p role="alert" className="text-sm text-destructive sm:col-span-2 xl:col-span-3">A data final deve ser igual ou posterior à data inicial.</p>}
      </div>}
      {(showActivity || active) && <>
        {entries.some(e => e.category === 'reserva') && <p className="mb-2 text-xs text-muted-foreground">Reservas disponíveis no Admin · histórico parcial</p>}
        {!entries.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum acontecimento neste filtro.</p>}
        <ol>{entries.map((e, i) => { const Icon = icons[e.category]; const day = historyDay(e); return <li key={e.id}>{(i === 0 || historyDay(entries[i - 1] ?? e) !== day) && <h4 className="border-b pb-2 pt-4 text-xs font-semibold text-muted-foreground">{day.split('-').reverse().join('/')}</h4>}<Button variant="ghost" className="h-auto w-full justify-start gap-3 rounded-lg py-3 text-left" onClick={() => setSelected(e)}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-primary"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block whitespace-normal break-words text-sm font-semibold">{e.title}</span><span className="mt-1 block whitespace-normal text-xs text-muted-foreground">{historyCategories[e.category]}{e.status !== 'registrado' ? ` · ${historyStatuses[e.status as keyof typeof historyStatuses] ?? e.status}` : ''}{e.room ? ` · ${e.room}` : ''}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Button></li>; })}</ol>
        {Boolean(offset || (q.data?.total ?? 0) > 30) && <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4"><Button variant="outline" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 30))}>Anterior</Button><span className="text-xs text-muted-foreground">{q.data?.total ? `${offset + 1}–${Math.min(offset + 30, q.data.total)} de ${q.data.total}` : '0 registros'}</span><Button variant="outline" disabled={offset + 30 >= (q.data?.total ?? 0)} onClick={() => setOffset(offset + 30)}>Próxima</Button></div>}
      </>}
    </>}
    {selected !== undefined && <PropertyHistoryDialog key={selected?.id ?? 'new'} implementationId={implementationId} entry={selected} defaultPhase={defaultPhase} onClose={() => setSelected(undefined)} />}
  </section>;
}
