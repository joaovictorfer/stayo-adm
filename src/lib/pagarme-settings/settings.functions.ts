import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { acceptsSandboxCredential, isSettingsAdmin } from './policy';

export const pagarmeSettingsStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  setResponseHeader('Cache-Control', 'no-store');
  const { data, error } = await context.supabase.rpc('has_admin_role', { roles: ['super_admin', 'admin'] });
  if (!isSettingsAdmin(data, error)) throw new Error('Configuração restrita aos administradores.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const result = await supabaseAdmin.from('pagarme_settings_vault').select('id,verified_at').eq('id', 'sandbox').maybeSingle();
  if (result.error) throw new Error('Não foi possível consultar a configuração.');
  return { configured: !!result.data, verifiedAt: result.data?.verified_at ?? null };
});

export const savePagarmeSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: { credential: string }) => {
    if (!acceptsSandboxCredential(input?.credential)) throw new Error('Informe uma chave secreta válida da Pagar.me (sk_...).');
    return { credential: input.credential };
  }).handler(async ({ data, context }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const role = await context.supabase.rpc('has_admin_role', { roles: ['super_admin', 'admin'] });
    if (!isSettingsAdmin(role.data, role.error)) throw new Error('Configuração restrita aos administradores.');
    const encryptionKey = process.env['STAYO_CREDENTIAL_ENCRYPTION_KEY'];
    if (!encryptionKey) throw new Error('Proteção da configuração indisponível.');
    try {
      const { encryptCredential } = await import('./vault.server');
      const encrypted = await encryptCredential(data.credential, encryptionKey);
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const result = await supabaseAdmin.from('pagarme_settings_vault').upsert({ id: 'sandbox', encrypted_key: encrypted, updated_by: context.userId, updated_at: new Date().toISOString(), verified_at: null });
      if (result.error) throw new Error('save');
      return { configured: true };
    } catch { throw new Error('Não foi possível salvar a configuração com segurança.'); }
  });

export const removePagarmeSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  setResponseHeader('Cache-Control', 'no-store');
  const role = await context.supabase.rpc('has_admin_role', { roles: ['super_admin', 'admin'] });
  if (!isSettingsAdmin(role.data, role.error)) throw new Error('Configuração restrita aos administradores.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const result = await supabaseAdmin.from('pagarme_settings_vault').delete().eq('id', 'sandbox');
  if (result.error) throw new Error('Não foi possível remover a configuração.');
  return { configured: false };
});

export const testPagarmeSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  setResponseHeader('Cache-Control', 'no-store');
  const role = await context.supabase.rpc('has_admin_role', { roles: ['super_admin', 'admin'] });
  if (!isSettingsAdmin(role.data, role.error)) throw new Error('Configuração restrita aos administradores.');
  const encryptionKey = process.env['STAYO_CREDENTIAL_ENCRYPTION_KEY'];
  if (!encryptionKey) return { ok: false, message: 'Proteção da configuração indisponível.' };
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const stored = await supabaseAdmin.from('pagarme_settings_vault').select('encrypted_key').eq('id', 'sandbox').maybeSingle();
  if (stored.error || !stored.data) return { ok: false, message: 'Salve a configuração antes de testar.' };
  try {
    const { decryptCredential } = await import('./vault.server');
    const credential = await decryptCredential(stored.data.encrypted_key, encryptionKey);
    if (!acceptsSandboxCredential(credential)) return { ok: false, message: 'Configuração indisponível.' };
    const response = await fetch('https://api.pagar.me/core/v5/orders?size=1', {
      method: 'GET', headers: { Authorization: `Basic ${btoa(`${credential}:`)}`, Accept: 'application/json' },
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    await response.body?.cancel();
    const verified = await supabaseAdmin.from('pagarme_settings_vault').update({ verified_at: response.ok ? new Date().toISOString() : null }).eq('id', 'sandbox').eq('encrypted_key', stored.data.encrypted_key);
    if (verified.error) return { ok: false, message: 'Não foi possível registrar o teste de conexão.' };
    if (response.ok) return { ok: true, message: 'Conexão confirmada. Nenhum pagamento foi criado.' };
    return { ok: false, message: response.status === 401 ? 'A Pagar.me recusou a autenticação. Substitua a chave de teste.' : response.status === 403 ? 'A Pagar.me recusou o acesso. Confira as permissões da conta.' : 'A Pagar.me está indisponível para esta consulta. Tente novamente.' };
  } catch { return { ok: false, message: 'Não foi possível confirmar a conexão. Tente novamente.' }; }
});