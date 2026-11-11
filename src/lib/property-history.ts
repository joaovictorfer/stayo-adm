import type { PropertyHistoryEntry } from '@/types/core';

export const historyCategories = { implantacao: 'Implantação', reserva: 'Reserva', compra: 'Compra / reposição', manutencao: 'Manutenção', higienizacao: 'Higienização', vistoria: 'Vistoria / conferência', ocorrencia: 'Ocorrência' };
export const historyStatuses = { aberta: 'Aberta', agendada: 'Agendada', em_andamento: 'Em andamento', aguardando_entrega: 'Aguardando entrega', parcial: 'Entrega parcial', recebido: 'Recebido', pendencia: 'Com pendência', concluido: 'Concluído', cancelado: 'Cancelado', registrado: 'Registrado' };
export interface HistoryFilters { search: string; phase: string; category: string; status: string; from: string; to: string; ascending: boolean; }
export function historyDay(e: PropertyHistoryEntry) { return e.dateOnly ? e.occurredAt.slice(0,10) : new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(e.occurredAt)); }
export function historyOutstanding(e: PropertyHistoryEntry) {
 if (['concluido','cancelado','registrado'].includes(e.status)) return { delivery: 0, checking: 0, needsCheck: false };
 const delivery = Math.max(0, (e.expectedQty ?? 0) - (e.receivedQty ?? 0));
 const checking = Math.max(0, (e.receivedQty ?? 0) - (e.checkedQty ?? 0));
 return { delivery, checking, needsCheck: checking > 0 || (e.category === 'compra' && e.status === 'recebido' && e.receivedQty === null) || (e.category === 'vistoria' && e.status !== 'concluido') };
}
export function latestHistoryEntries(entries: PropertyHistoryEntry[]) {
 const latest = new Map<string, PropertyHistoryEntry>();
 for (const e of entries) {
  const key = e.caseId ?? e.id;
  const previous = latest.get(key);
  if (!previous || e.revision > previous.revision) latest.set(key, e);
 }
 return [...latest.values()];
}
export function filterPropertyHistory(entries: PropertyHistoryEntry[], f: HistoryFilters) {
 const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const source = ['pending','to_check','to_deliver'].includes(f.status) ? latestHistoryEntries(entries) : entries;
 return source.filter(e => (!f.phase || e.phase === f.phase) && (!f.category || e.category === f.category) && (!f.status || e.status === f.status || (f.status === 'pending' && !['concluido','cancelado','registrado'].includes(e.status)) || (f.status === 'to_check' && historyOutstanding(e).needsCheck) || (f.status === 'to_deliver' && (historyOutstanding(e).delivery > 0 || e.status === 'aguardando_entrega'))) && (!f.from || historyDay(e)>=f.from) && (!f.to || historyDay(e)<=f.to) && normalize([e.title,e.description,e.supplier,e.responsible,e.room].join(' ')).includes(normalize(f.search))).sort((a,b) => (Date.parse(a.occurredAt)-Date.parse(b.occurredAt))*(f.ascending?1:-1) || a.id.localeCompare(b.id));
}
export function validateHistoryQuantities(category: string, status: string, expected: number | null, received: number | null, checked: number | null) {
 if ([expected,received,checked].some(n=>n!==null && (!Number.isInteger(n)||n<0))) return 'Use quantidades inteiras e não negativas.';
 if (received!==null && expected!==null && received>expected) return 'Recebido não pode superar a quantidade prevista.';
 if (checked!==null && (received===null || checked>received)) return 'Conferido não pode superar a quantidade recebida.';
 if (category==='compra' && status==='concluido' && (!expected || received!==expected || checked!==expected)) return 'Confira toda a quantidade antes de concluir a compra.';
 return null;
}