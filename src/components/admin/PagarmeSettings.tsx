import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { CreditCard, ShieldCheck, Save, PlugZap, Trash2, RefreshCw, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pagarmeSettingsStatus, savePagarmeSettings, removePagarmeSettings, testPagarmeSettings } from '@/lib/pagarme-settings/settings.functions';

export function PagarmeSettings() {
  const read = useServerFn(pagarmeSettingsStatus);
  const save = useServerFn(savePagarmeSettings);
  const test = useServerFn(testPagarmeSettings);
  const remove = useServerFn(removePagarmeSettings);
  const query = useQuery({ queryKey: ['pagarme-settings'], queryFn: () => read(), retry: false });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  async function run(action: () => Promise<string>) {
    setBusy(true); setNotice('');
    try { setNotice(await action()); await query.refetch(); }
    catch { setNotice('Não foi possível concluir. Confira seu acesso e tente novamente.'); }
    finally { setBusy(false); }
  }
  return <section className="mb-8 border-b border-border pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4 mb-5">
      <div className="flex items-center gap-3"><CreditCard className="text-primary" size={24}/><div><h2 className="text-xl font-semibold">Pagar.me</h2><p className="text-sm text-muted-foreground">Cobranças · ambiente de testes</p></div></div>
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck size={16}/>Recebimentos reais desativados</span>
    </header>
    {query.isPending ? <div role="status" aria-label="Carregando configuração" className="h-28 bg-muted animate-pulse rounded-md"/> : query.isError ?
      <div role="alert" className="space-y-3"><p className="text-sm text-muted-foreground">Configuração restrita ou indisponível.</p><Button variant="outline" onClick={() => query.refetch()}><RefreshCw/>Tentar novamente</Button></div> :
      <div className="max-w-xl space-y-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm"><div><dt className="text-muted-foreground">Credencial</dt><dd className="font-medium mt-1">{query.data?.configured ? 'Configurada' : 'Não configurada'}</dd></div><div><dt className="text-muted-foreground">Conexão</dt><dd className="font-medium mt-1">{query.data?.verifiedAt ? 'Teste confirmado' : 'Aguardando teste'}</dd></div></dl>
        <form autoComplete="off" className="space-y-3" onSubmit={event => {
          event.preventDefault();
          const credential = input.current?.value ?? '';
          if (input.current) input.current.value = '';
          void run(async () => { await save({ data: { credential } }); return 'Configuração salva com segurança. Teste a conexão.'; });
        }}>
          <label htmlFor="pagarme-test-key" className="block text-sm font-medium">{query.data?.configured ? 'Substituir chave de teste' : 'Chave secreta de teste'}</label>
          <Input ref={input} id="pagarme-test-key" type="password" autoComplete="new-password" spellCheck={false} required disabled={busy} aria-describedby="pagarme-key-help" />
          <p id="pagarme-key-help" className="text-xs text-muted-foreground">Pagar.me → Configurações → Chaves de API → ambiente de testes.</p>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}><Save/>{busy ? 'Aguarde…' : 'Salvar configuração'}</Button><Button type="button" variant="outline" disabled={busy || !query.data?.configured} onClick={() => void run(async () => (await test()).message)}><PlugZap/>Testar conexão</Button></div>
        </form>
        <p className="flex items-start gap-2 text-xs text-muted-foreground"><LockKeyhole size={15} className="shrink-0"/>A chave fica protegida e não será exibida novamente.</p>
        {query.data?.configured && (!confirmRemove ? <Button variant="ghost" disabled={busy} onClick={() => setConfirmRemove(true)}><Trash2/>Remover configuração</Button> : <div className="flex flex-wrap items-center gap-2"><span className="text-sm">Remover a conexão de teste?</span><Button variant="destructive" disabled={busy} onClick={() => void run(async () => { await remove(); setConfirmRemove(false); return 'Configuração removida.'; })}>Confirmar remoção</Button><Button variant="ghost" disabled={busy} onClick={() => setConfirmRemove(false)}>Cancelar</Button></div>)}
      </div>}
    {notice && <p role="status" className="mt-4 text-sm text-muted-foreground">{notice}</p>}
  </section>;
}