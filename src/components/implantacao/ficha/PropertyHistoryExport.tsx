import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { readPropertyHistory } from '@/lib/api/core-client';
import { historyStatuses } from '@/lib/property-history';
import { ownerHistoryRows, type OwnerHistoryRow } from '@/lib/pdf/property-history-report';
import type { PropertyHistoryEntry } from '@/types/core';

export function PropertyHistoryExport({ implementationId, property, code, from, to }: { implementationId: string; property: string; code: string; from: string; to: string }) {
  const read = useServerFn(readPropertyHistory);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<OwnerHistoryRow[]>([]); const [excluded, setExcluded] = useState<string[]>([]);
  const [period, setPeriod] = useState('');
  async function prepare() {
    if (from && to && from > to) { toast.error('Confira o período selecionado.'); return; }
    setBusy(true);
    try {
      const entries: PropertyHistoryEntry[] = [];
      for (const category of ['compra', 'vistoria']) {
        let offset = 0;
        while (true) {
          const result = await read({ data: { implementationId, offset, filters: { search: '', phase: '', category, status: '', from, to, ascending: true } } });
          if (result.warnings.length) throw new Error('Histórico incompleto. Tente carregar novamente antes de gerar o PDF.');
          entries.push(...result.entries); offset += result.entries.length;
          if (offset >= result.total) break;
          if (!result.entries.length) throw new Error('Não foi possível carregar todos os registros.');
        }
      }
      const projected = ownerHistoryRows(entries);
      if (!projected.length) { toast.info('Não há compras ou conferências neste período.'); return; }
      setRows(projected); setExcluded([]);
      const day = (s: string) => s.split('-').reverse().join('/');
      setPeriod(from || to ? `${from ? day(from) : 'Início'} a ${to ? day(to) : 'hoje'}` : 'Histórico completo'); setOpen(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível preparar o relatório.'); }
    finally { setBusy(false); }
  }
  async function download() {
    setBusy(true);
    try { const { downloadHistoryPdf } = await import('@/lib/pdf/property-history-download'); await downloadHistoryPdf({ property, code, period, rows: rows.filter(r => !excluded.includes(r.id)) }); toast.success('PDF do histórico gerado.'); setOpen(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.'); }
    finally { setBusy(false); }
  }
  return <><Button variant="outline" disabled={busy} onClick={() => void prepare()}><FileText className="size-4" />{busy ? 'Preparando…' : 'PDF para proprietário'}</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col rounded-lg"><DialogHeader><DialogTitle>Histórico para o proprietário</DialogTitle><DialogDescription>{property} · {period}. Revise os títulos e selecione os registros antes de baixar. Observações internas, contatos e motivos de retificação não serão incluídos.</DialogDescription></DialogHeader>
      <div className="min-h-0 overflow-y-auto"><ul className="divide-y">{rows.map(r => <li key={r.id} className="flex items-start gap-3 py-3"><Checkbox className="mt-2 shrink-0" aria-label={`Incluir registro ${r.id}`} checked={!excluded.includes(r.id)} onCheckedChange={v => setExcluded(old => v ? old.filter(id => id !== r.id) : [...old, r.id])} /><div className="min-w-0 flex-1"><Input aria-label={`Título do registro ${r.id}`} value={r.title} onChange={e => setRows(old => old.map(row => row.id === r.id ? { ...row, title: e.target.value } : row))} /><p className="mt-1 text-xs text-muted-foreground">{r.day.split('-').reverse().join('/')} · {historyStatuses[r.status as keyof typeof historyStatuses] ?? r.status}{r.category === 'compra' ? ` · Recebido: ${r.received ?? 'Não informado'} · Conferido: ${r.checked ?? 'Não informado'}` : ''}</p></div></li>)}</ul></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><span className="text-xs text-muted-foreground">{rows.length - excluded.length} registros selecionados</span><Button disabled={busy || rows.every(r => excluded.includes(r.id)) || rows.some(r => !excluded.includes(r.id) && !r.title.trim())} onClick={() => void download()}><Download className="size-4" />{busy ? 'Gerando…' : 'Baixar PDF'}</Button></div>
    </DialogContent></Dialog></>;
}