import { z } from 'zod';
import { getSupabaseBrowserClient } from './supabase-client';
import { autosaveOpportunity } from './opportunity-form';

export const contractSummaryPatchSchema = z.object({
  administration_fee: z.number().min(0).max(100).nullable().optional(),
  turnover_cleaning_fee: z.number().min(0).nullable().optional(),
  cleaning_responsibility: z.string().nullable().optional(),
  payout_rule: z.string().nullable().optional(),
  owner_use_notes: z.string().nullable().optional(),
  marketing_rule: z.string().nullable().optional(),
  periodic_shutdown_rule: z.string().nullable().optional(),
  maintenance_limit: z.number().min(0).nullable().optional(),
  duration_months: z.number().int().min(1).nullable().optional(),
  notice_period_days: z.number().int().min(0).nullable().optional(),
}).strict();
export type ContractSummaryPatch = z.infer<typeof contractSummaryPatchSchema>;

/** Only changed working-copy fields; never publishes or replays accepted snapshots. */
export async function saveContractSummary(implementationId: string, input: ContractSummaryPatch) {
  const patch = contractSummaryPatchSchema.parse(input);
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error('Cadastro indisponível.');
  if (!Object.keys(patch).length) return;
  const { error } = await client.from('implementation_contract_conditions').upsert({ implementation_id: implementationId, ...patch }, { onConflict: 'implementation_id' });
  if (error) throw error;
}

type PropertyAddress = { unit: string; tower: string; street: string; number: string; complement: string; district: string; city: string; state: string; postalCode: string };
export async function saveContractProperty(id: string, base: PropertyAddress, values: PropertyAddress) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error('Cadastro indisponível.');
  const patch: Partial<Record<'unit' | 'tower', string>> = {};
  if (values.unit !== base.unit) patch.unit = values.unit;
  if (values.tower !== base.tower) patch.tower = values.tower;
  if (Object.keys(patch).length) {
    const result = await autosaveOpportunity(id, patch, { unit: base.unit, tower: base.tower });
    if (result.conflicts.length) throw new Error('Cadastro alterado por outra pessoa. Reabra a janela.');
  }
  const addressPatch = Object.fromEntries((['street', 'number', 'complement', 'district', 'city', 'state', 'postalCode'] as const).filter(key => values[key] !== base[key]).map(key => [key === 'postalCode' ? 'postal_code' : key, values[key].trim() || null]));
  if (!Object.keys(addressPatch).length) return;
  const { error } = await client.from('implementation_property_details').upsert({ implementation_id: id, ...addressPatch }, { onConflict: 'implementation_id' });
  if (error) throw error;
}