import type { PropertyHistoryEntry } from '@/types/core';
import { historyDay, historyOutstanding } from '../property-history';

export interface OwnerHistoryRow {
  id: string; caseId: string | null; revision: number; title: string; category: 'compra' | 'vistoria';
  phase: string; status: string; day: string; time: string; expected: number | null;
  received: number | null; checked: number | null; amount: number | null;
  delivery: number; checking: number; needsCheck: boolean;
}
/** Explicit owner-facing projection: never pass administrative free text or identities to the PDF. */
export function ownerHistoryRows(entries: PropertyHistoryEntry[]): OwnerHistoryRow[] {
  return entries.filter((e): e is PropertyHistoryEntry & { category: 'compra' | 'vistoria' } => e.category === 'compra' || e.category === 'vistoria').map(e => ({
    id: e.id, caseId: e.caseId, revision: e.revision, title: e.title,
    category: e.category, phase: e.phase, status: e.status, day: historyDay(e),
    time: e.dateOnly ? '' : new Date(e.occurredAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
    expected: e.expectedQty, received: e.receivedQty, checked: e.checkedQty, amount: e.amountCents,
    ...historyOutstanding(e),
  })).sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time) || a.revision - b.revision || a.id.localeCompare(b.id));
}
export function ownerHistorySummary(rows: OwnerHistoryRow[]) {
  const latest = new Map<string, OwnerHistoryRow>();
  for (const r of rows) { const key = r.caseId ?? r.id; if (r.revision >= (latest.get(key)?.revision ?? -1)) latest.set(key, r); }
  const current = [...latest.values()];
  return { purchases: current.filter(r => r.category === 'compra').length, delivery: current.reduce((n, r) => n + r.delivery, 0), checking: current.reduce((n, r) => n + r.checking, 0) };
}