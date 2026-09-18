-- Fase 17H: Owner Auth — o proprietário passa a poder ter conta própria
-- (e-mail/senha via Supabase Auth), vinculada ao registro dele em
-- owner_records via auth.uid() — nunca senha guardada manualmente, nunca
-- decidida só no React.
--
-- Problema real que travava isto até aqui: nada no schema ligava um
-- `implementation_id` (usado no convite/onboarding, migrations 0004/0007)
-- a um `owner_id` de verdade, exceto via `implementation_projects.owner_id`
-- — e essa tabela ainda não tem adapter Supabase ligado (ver
-- docs/DATA_PERSISTENCE.md), então não tem dado real para juntar. Em vez
-- de fazer o Owner Auth esperar essa troca de adapter (que é sobre UI,
-- não sobre esta feature), este `owner_id` foi adicionado direto em
-- `owner_portal_invitations` — o admin já sabe o proprietário no momento
-- em que gera o convite (tela de Implantação), então gravar isso ali
-- resolve a dependência sem esperar nada.

alter table owner_portal_invitations add column owner_id uuid references owner_records (id);

create table owner_portal_accounts (
  id uuid primary key references auth.users (id),
  owner_id uuid not null unique references owner_records (id),
  created_at timestamptz not null default now()
);

alter table owner_portal_accounts enable row level security;

-- Só leitura direta — nenhuma policy de insert/update/delete aqui de
-- propósito. A única forma de criar uma linha é via
-- `owner_account_link` (abaixo), que roda como `security definer` e
-- revalida o convite antes de vincular; isso impede um proprietário (ou
-- qualquer usuário autenticado) de se auto-vincular a um `owner_id`
-- arbitrário direto por SQL/REST.
create policy "proprietário lê a própria conta"
  on owner_portal_accounts for select
  using (id = auth.uid());

create policy "time interno lê contas de proprietário"
  on owner_portal_accounts for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

-- ---------------------------------------------------------------------
-- RLS de leitura do PRÓPRIO proprietário nas tabelas que ele deveria
-- poder ver — sempre via join a `owner_portal_accounts`, nunca client-side.
-- Ainda sem policy de escrita para o proprietário: os fluxos de escrita
-- dele continuam passando pelas RPCs `security definer` já existentes
-- (`owner_onboarding_submit`, `proposal_accept_by_token`), que revalidam
-- tudo server-side em vez de confiar num `update` direto sob RLS de sessão.
-- ---------------------------------------------------------------------

create policy "proprietário lê o próprio registro"
  on owner_records for select
  using (exists (
    select 1 from owner_portal_accounts opa
    where opa.id = auth.uid() and opa.owner_id = owner_records.id
  ));

create policy "proprietário lê as próprias implantações"
  on implementation_projects for select
  using (exists (
    select 1 from owner_portal_accounts opa
    where opa.id = auth.uid() and opa.owner_id = implementation_projects.owner_id
  ));

create policy "proprietário lê as próprias propostas"
  on proposals for select
  using (exists (
    select 1
    from implementation_projects ip
    join owner_portal_accounts opa on opa.owner_id = ip.owner_id
    where ip.id = proposals.implementation_id and opa.id = auth.uid()
  ));

create policy "proprietário lê as próprias cobranças"
  on initial_charges for select
  using (exists (
    select 1 from owner_portal_accounts opa
    where opa.id = auth.uid() and opa.owner_id = initial_charges.owner_id
  ));

-- ---------------------------------------------------------------------
-- Vínculo da conta — chamado pelo proprietário logo depois de criar a
-- conta no Supabase Auth (signUp), com o MESMO token do convite que já
-- usou para o auto-cadastro. Precisa de sessão (auth.uid() não nulo) —
-- diferente das RPCs de onboarding/proposta, que são para `anon`.
-- ---------------------------------------------------------------------

create or replace function owner_account_link(p_token text)
returns owner_portal_accounts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invitation owner_portal_invitations%rowtype;
  v_account owner_portal_accounts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;

  select * into v_invitation
  from owner_portal_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'convite não encontrado';
  end if;
  if v_invitation.revoked_at is not null then
    raise exception 'convite revogado';
  end if;
  if v_invitation.expires_at < now() then
    raise exception 'convite expirado';
  end if;
  if v_invitation.owner_id is null then
    raise exception 'convite sem proprietário vinculado';
  end if;

  insert into owner_portal_accounts (id, owner_id)
  values (auth.uid(), v_invitation.owner_id)
  on conflict (id) do nothing
  returning * into v_account;

  if not found then
    select * into v_account from owner_portal_accounts where id = auth.uid();
  end if;

  return v_account;
end;
$$;

grant execute on function owner_account_link(text) to authenticated;
