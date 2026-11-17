import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { saveContractSummary, type ContractSummaryPatch } from '@/lib/api/core-client';
import type { ProposalSnapshotContractConditions } from '@/types/commercial-proposal';

const fields = [
  ['administration_fee', 'administrationFee', 'Administração (%)', 'number'],
  ['turnover_cleaning_fee', 'turnoverCleaningFee', 'Limpeza (R$)', 'number'],
  ['cleaning_responsibility', 'cleaningResponsibility', 'Condição da limpeza', 'text'],
  ['payout_rule', 'payoutRule', 'Repasses', 'text'],
  ['owner_use_notes', 'ownerUseNotes', 'Uso pelo proprietário', 'text'],
  ['marketing_rule', 'marketingRule', 'Uso para marketing', 'text'],
  ['maintenance_limit', 'maintenanceLimit', 'Manutenção emergencial (R$)', 'number'],
  ['periodic_shutdown_rule', 'periodicShutdownRule', 'Paralisação periódica', 'text'],
  ['duration_months', 'durationMonths', 'Vigência (meses)', 'number'],
  ['notice_period_days', 'noticePeriodDays', 'Aviso prévio (dias)', 'number'],
] as const;

export function ContractSummaryEditor({ implementationId, initial, onDone }: { implementationId: string; initial: ProposalSnapshotContractConditions; onDone: () => void }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map(([key, source]) => [key, initial[source] == null ? '' : String(initial[source])])));
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); setSaving(true);
    try {
      const patch = Object.fromEntries(fields.filter(([key]) => changed.has(key)).map(([key, , , kind]) => [key, values[key]?.trim() ? kind === 'number' ? Number(values[key]?.replace(',', '.')) : values[key]?.trim() : null])) as ContractSummaryPatch;
      await saveContractSummary(implementationId, patch);
      await Promise.all([qc.invalidateQueries({ queryKey: ['contract-copy-conditions', implementationId] }), qc.invalidateQueries({ queryKey: ['implementation-contract-conditions', implementationId] })]);
      toast.success('Condições salvas na ficha'); onDone();
    } catch { toast.error('Não foi possível salvar. Confira os valores e tente novamente.'); }
    finally { setSaving(false); }
  }}>
    <fieldset disabled={saving} className="grid min-w-0 gap-4 sm:grid-cols-2">
      {fields.map(([key, , label, kind]) => <label key={key} className={`min-w-0 space-y-1 text-sm ${kind === 'text' ? 'sm:col-span-2' : ''}`}><span className="font-medium">{label}</span>{kind === 'text' ? <Textarea value={values[key]} rows={3} onChange={event => { setValues(v => ({ ...v, [key]: event.target.value })); setChanged(v => new Set(v).add(key)); }} /> : <Input inputMode="decimal" value={values[key]} onChange={event => { setValues(v => ({ ...v, [key]: event.target.value })); setChanged(v => new Set(v).add(key)); }} />}</label>)}
    </fieldset>
    <p className="text-xs text-muted-foreground">As condições ficam na ficha; propostas já aceitas permanecem preservadas.</p>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving || !changed.size}>{saving ? <Loader2 className="animate-spin" /> : <Check />}Salvar na ficha</Button><Button type="button" variant="outline" disabled={saving} onClick={onDone}><X />Cancelar</Button></div>
  </form>;
}