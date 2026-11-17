import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { saveContractSummary, type ContractSummaryPatch } from '@/lib/api/core-client';
import type { ProposalSnapshotContractConditions } from '@/types/commercial-proposal';
import { STANDARD_CLAUSES } from '@/lib/contract-standard-clauses';

/** Padrão do contrato oficial mostrado quando a ficha ainda não tem texto próprio. */
const standardDefaults: Record<string, string> = { cleaning_responsibility: STANDARD_CLAUSES.cleaning, payout_rule: STANDARD_CLAUSES.payout, owner_use_notes: STANDARD_CLAUSES.ownerUse, marketing_rule: STANDARD_CLAUSES.marketing, periodic_shutdown_rule: STANDARD_CLAUSES.periodicShutdown, maintenance_limit: String(STANDARD_CLAUSES.maintenanceLimit), duration_months: String(STANDARD_CLAUSES.durationMonths), notice_period_days: String(STANDARD_CLAUSES.noticePeriodDays) };

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

export function ContractSummaryEditor({ implementationId, initial, onDone, focusField }: { implementationId: string; initial: ProposalSnapshotContractConditions; onDone: () => void; focusField?: string | undefined }) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (focusField) formRef.current?.querySelector<HTMLElement>(`[name="${focusField}"]`)?.focus(); }, [focusField]);
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map(([key, source]) => [key, initial[source] == null || initial[source] === '' ? standardDefaults[key] ?? '' : String(initial[source])])));
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  return <form ref={formRef} className="space-y-4" onSubmit={async event => {
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
      {fields.map(([key, , label, kind]) => <label key={key} className={`min-w-0 space-y-1 text-sm ${kind === 'text' ? 'sm:col-span-2' : ''}`}><span className="font-medium">{label}</span>{kind === 'text' ? <Textarea name={key} value={values[key]} rows={3} onChange={event => { setValues(v => ({ ...v, [key]: event.target.value })); setChanged(v => new Set(v).add(key)); }} /> : <Input name={key} inputMode="decimal" value={values[key]} onChange={event => { setValues(v => ({ ...v, [key]: event.target.value })); setChanged(v => new Set(v).add(key)); }} />}</label>)}
    </fieldset>
    <p className="text-xs text-muted-foreground">Os textos já vêm com o padrão do contrato STAYO. Altere só o que for diferente neste imóvel; propostas já aceitas permanecem preservadas.</p>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving || !changed.size}>{saving ? <Loader2 className="animate-spin" /> : <Check />}Salvar na ficha</Button><Button type="button" variant="outline" disabled={saving} onClick={onDone}><X />Cancelar</Button></div>
  </form>;
}