import { describe, expect, it } from 'vitest';
import { contractSummaryPatchSchema } from './contract-summary';
import { buildContractCopy } from '../contract-copy';
import { contractRowToSnapshot } from '../contract-conditions';

describe('contract summary editing', () => {
  it('accepts only changed fields without replacing other conditions', () => {
    expect(contractSummaryPatchSchema.parse({ administration_fee: 20 })).toEqual({ administration_fee: 20 });
    expect(contractSummaryPatchSchema.safeParse({ administration_fee: 101 }).success).toBe(false);
    expect(contractSummaryPatchSchema.safeParse({ published_at: 'now' }).success).toBe(false);
  });
  it('reads saved marketing and periodic shutdown in the summary', () => {
    const copy = buildContractCopy({ people: [], ownerAddress: {}, property: {}, conditions: contractRowToSnapshot({ marketing_rule: 'Fotos autorizadas.', periodic_shutdown_rule: 'Aviso de 30 dias.', owner_use_notes: 'Até 10 dias.' }) });
    expect(copy.rows[6]?.body).toBe('Fotos autorizadas.');
    expect(copy.rows[8]?.body).toBe('Aviso de 30 dias.');
    expect(copy.rows[5]?.body).toContain('Até 10 dias.');
  });
});