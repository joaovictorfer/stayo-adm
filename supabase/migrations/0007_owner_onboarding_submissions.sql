-- Fase 16: promove o auto-cadastro do proprietário (Fase 8) ao mesmo
-- padrão local+Supabase do resto do AdminApiClient.
--
-- `owner_portal_invitations` já existe desde a migration 0004 (schema
-- pronto, mas sem adapter Supabase até agora — ver
-- docs/LOCALSTORAGE_MIGRATION.md). Esta migration adiciona a tabela que
-- faltava (o envio do formulário em si) e resolve o problema real que
-- travou a promoção antes: quem acessa o portal público NÃO é um usuário
-- autenticado do time interno — é um visitante anônimo com só a chave
-- `anon`. As RLS de `owner_portal_invitations`/`owner_onboarding_submissions`
-- continuam restritas ao time interno (leitura/gestão administrativa);
-- o caminho público passa por duas funções `security definer`, que fazem
-- exatamente a validação que o app já fazia no cliente (hash do token,
-- checar expiração/revogação/uso) antes de tocar a tabela — nunca abrindo
-- a tabela inteira para qualquer anônimo.

create table owner_onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null unique,
  full_name text not null,
  document text,
  email text not null,
  phone text not null,
  pix_key text,
  submitted_at timestamptz not null default now()
);

create index owner_onboarding_submissions_implementation_idx
  on owner_onboarding_submissions (implementation_id);

alter table owner_onboarding_submissions enable row level security;

create policy "time interno lê envios de auto-cadastro"
  on owner_onboarding_submissions for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create policy "comercial/admin gerenciam envios de auto-cadastro"
  on owner_onboarding_submissions for all
  using (has_admin_role('super_admin', 'admin', 'commercial'))
  with check (has_admin_role('super_admin', 'admin', 'commercial'));

-- ---------------------------------------------------------------------
-- Caminho público (portal do proprietário, sem autenticação)
-- ---------------------------------------------------------------------

-- Supabase instala extensões no schema `extensions`, não `public` — o
-- search_path das duas funções abaixo precisa incluir os dois, senão
-- `digest()` (usado no hash do token) não resolve.
create extension if not exists pgcrypto with schema extensions;

-- Resolve um token em texto puro (só o que chega na URL) para os dados
-- públicos do convite — nunca expõe `token_hash` nem qualquer outra
-- coluna sensível. Mesmo hash usado no cliente (src/lib/api/token-hash.ts):
-- SHA-256, hex minúsculo, sem separador.
create or replace function owner_onboarding_resolve_token(p_token text)
returns table (
  implementation_id uuid,
  expires_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select implementation_id, expires_at, used_at, revoked_at
  from owner_portal_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  limit 1;
$$;

grant execute on function owner_onboarding_resolve_token(text) to anon, authenticated;

-- Envia o formulário de auto-cadastro. Revalida tudo server-side (nunca
-- confia só na validação já feita no cliente): token precisa resolver a
-- um convite existente, não revogado, não usado e não expirado. Marca o
-- convite como usado e grava o envio, atomicamente — um token usado nunca
-- aceita um segundo envio, mesmo em duas abas simultâneas.
create or replace function owner_onboarding_submit(
  p_token text,
  p_full_name text,
  p_document text,
  p_email text,
  p_phone text,
  p_pix_key text
)
returns owner_onboarding_submissions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invitation owner_portal_invitations%rowtype;
  v_submission owner_onboarding_submissions%rowtype;
begin
  select * into v_invitation
  from owner_portal_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'convite não encontrado';
  end if;
  if v_invitation.revoked_at is not null then
    raise exception 'convite revogado';
  end if;
  if v_invitation.used_at is not null then
    raise exception 'convite já usado';
  end if;
  if v_invitation.expires_at < now() then
    raise exception 'convite expirado';
  end if;

  update owner_portal_invitations
  set used_at = now()
  where id = v_invitation.id;

  insert into owner_onboarding_submissions
    (implementation_id, full_name, document, email, phone, pix_key)
  values
    (v_invitation.implementation_id, p_full_name, p_document, p_email, p_phone, p_pix_key)
  returning * into v_submission;

  return v_submission;
end;
$$;

grant execute on function owner_onboarding_submit(text, text, text, text, text, text)
  to anon, authenticated;
