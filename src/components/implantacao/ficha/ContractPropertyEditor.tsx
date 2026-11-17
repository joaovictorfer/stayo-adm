import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PostalCodeInput } from '@/components/ui/postal-code-input';
import { saveContractProperty } from '@/lib/api/core-client';
import type { ImplementationProject } from '@/types/core';
import type { ContractCopyInput } from '@/lib/contract-copy';

export function ContractPropertyEditor({ project, address, onDone }: { project: ImplementationProject; address: ContractCopyInput['property']; onDone: () => void }) {
  const initial = { unit: project.unit ?? '', tower: project.tower ?? '', street: address.street ?? '', number: address.number ?? '', complement: address.complement ?? '', district: address.district ?? '', city: address.city ?? '', state: address.state ?? '', postalCode: address.postalCode ?? '' };
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); setBusy(true);
    try { await saveContractProperty(project.id, initial, values); await qc.invalidateQueries(); toast.success('Imóvel salvo na ficha'); onDone(); }
    catch { toast.error('Não foi possível salvar. Confira os dados e tente novamente.'); } finally { setBusy(false); }
  }}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
    {([['unit','Apartamento'],['tower','Torre'],['postalCode','CEP'],['street','Logradouro'],['number','Número'],['complement','Complemento'],['district','Bairro'],['city','Cidade'],['state','UF']] as const).map(([key,label]) => <label key={key} className="min-w-0 space-y-1 text-sm"><span>{label}</span>{key === 'postalCode' ? <PostalCodeInput disabled={busy} value={values.postalCode} onChange={postalCode => setValues(v => ({ ...v, postalCode }))} onAddress={patch => setValues(v => ({ ...v, ...patch }))} /> : <Input value={values[key]} onChange={event => setValues(v => ({ ...v, [key]: event.target.value }))} />}</label>)}
  </fieldset><div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar imóvel'}</Button><Button type="button" variant="outline" disabled={busy} onClick={onDone}>Cancelar</Button></div></form>;
}