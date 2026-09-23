-- Jornada única do proprietário: Proposta -> Dados -> Imóvel -> Acesso.
--
-- O convite de onboarding passa a carregar a versão EXATA da proposta
-- apresentada ao proprietário. O vínculo é congelado na criação do convite;
-- criar uma nova versão depois nunca altera o que aquele link mostra.
-- Links legados permanecem válidos e podem ficar sem proposal_id.

alter table public.owner_portal_invitations
  add column if not exists proposal_id uuid references public.proposals(id) on delete restrict;

create index if not exists owner_portal_invitations_proposal_idx
  on public.owner_portal_invitations (proposal_id);

-- Convites antigos recebem a versão mais recente disponível NO MOMENTO desta
-- migration. Se ainda não houver proposta persistida, continuam sem vínculo e
-- o portal mostra "proposta em preparação" em vez de inventar dados.
update public.owner_portal_invitations as invitation
set proposal_id = (
  select proposal.id
  from public.proposals as proposal
  where proposal.implementation_id = invitation.implementation_id
  order by proposal.version desc, proposal.created_at desc
  limit 1
)
where invitation.proposal_id is null
  and exists (
    select 1
    from public.proposals as proposal
    where proposal.implementation_id = invitation.implementation_id
  );

create or replace function public.owner_onboarding_bind_proposal()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_implementation_id uuid;
begin
  if new.proposal_id is null then
    select proposal.id into new.proposal_id
    from public.proposals as proposal
    where proposal.implementation_id = new.implementation_id
    order by proposal.version desc, proposal.created_at desc
    limit 1;
  else
    select proposal.implementation_id into v_implementation_id
    from public.proposals as proposal
    where proposal.id = new.proposal_id;

    if v_implementation_id is null then
      raise exception 'proposta não encontrada';
    end if;
    if v_implementation_id <> new.implementation_id then
      raise exception 'proposta não pertence à implantação do convite';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists owner_portal_invitations_bind_proposal on public.owner_portal_invitations;
create trigger owner_portal_invitations_bind_proposal
  before insert on public.owner_portal_invitations
  for each row execute function public.owner_onboarding_bind_proposal();

-- Resolve somente os dados comerciais necessários à primeira etapa pública.
-- Token/hash e demais colunas internas nunca saem desta função.
create or replace function public.owner_journey_resolve_proposal(p_token text)
returns table (
  proposal_id uuid,
  implementation_id uuid,
  version integer,
  items jsonb,
  total numeric,
  accepted_at timestamptz,
  accepted_name text,
  created_at timestamptz,
  commercial_terms jsonb,
  contract_conditions jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_invitation public.owner_portal_invitations%rowtype;
  v_proposal public.proposals%rowtype;
  v_terms jsonb := '[]'::jsonb;
  v_conditions jsonb := null;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 200 then
    return;
  end if;

  select * into v_invitation
  from public.owner_portal_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  limit 1;

  if not found then return; end if;
  if v_invitation.revoked_at is not null or v_invitation.expires_at < now() then return; end if;
  if v_invitation.proposal_id is null then return; end if;

  select * into v_proposal
  from public.proposals
  where id = v_invitation.proposal_id;
  if not found then return; end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', term.id,
        'label', term.label,
        'chargeType', term.charge_type,
        'value', term.value,
        'optional', term.optional,
        'displayOrder', term.display_order,
        'notes', term.notes
      ) order by term.display_order
    ),
    '[]'::jsonb
  ) into v_terms
  from public.commercial_terms as term
  where term.implementation_id = v_proposal.implementation_id;

  -- A tabela nasceu em uma linha de migrations mais nova do Admin. O uso de
  -- SQL dinâmico evita que esta função deixe de ser criada em um ambiente que
  -- ainda não recebeu aquela migration; nesse caso o resumo simplesmente não
  -- inclui o bloco de condições contratuais.
  if to_regclass('public.implementation_contract_conditions') is not null then
    execute
      'select to_jsonb(c) from public.implementation_contract_conditions c where c.implementation_id = $1 limit 1'
      into v_conditions
      using v_proposal.implementation_id;
  end if;

  return query select
    v_proposal.id,
    v_proposal.implementation_id,
    v_proposal.version,
    v_proposal.items,
    v_proposal.total,
    v_proposal.accepted_at,
    v_proposal.accepted_name,
    v_proposal.created_at,
    v_terms,
    v_conditions;
end;
$$;

revoke all on function public.owner_journey_resolve_proposal(text) from public;
grant execute on function public.owner_journey_resolve_proposal(text) to anon, authenticated;

-- Aceite comercial pelo MESMO link de onboarding. É idempotente: a primeira
-- confirmação congela data e nome; cliques repetidos apenas devolvem o estado.
-- O side effect financeiro antigo (fixed_once -> initial_charges) e o evento
-- de auditoria também ficam atômicos no servidor, sem depender de um cliente
-- anônimo ter permissão direta nessas tabelas.
create or replace function public.owner_journey_accept_proposal(
  p_token text,
  p_accepted_name text
)
returns table (
  proposal_id uuid,
  implementation_id uuid,
  version integer,
  items jsonb,
  total numeric,
  accepted_at timestamptz,
  accepted_name text,
  created_at timestamptz,
  commercial_terms jsonb,
  contract_conditions jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invitation public.owner_portal_invitations%rowtype;
  v_proposal public.proposals%rowtype;
  v_name text := regexp_replace(trim(coalesce(p_accepted_name, '')), '\s+', ' ', 'g');
  v_charge_items jsonb := '[]'::jsonb;
  v_charge_amount numeric := 0;
begin
  if length(v_name) < 3 or length(v_name) > 120 then
    raise exception 'nome de aceite inválido';
  end if;
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 200 then
    raise exception 'convite inválido';
  end if;

  select * into v_invitation
  from public.owner_portal_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then raise exception 'convite não encontrado'; end if;
  if v_invitation.revoked_at is not null then raise exception 'convite revogado'; end if;
  if v_invitation.expires_at < now() then raise exception 'convite expirado'; end if;
  if v_invitation.proposal_id is null then raise exception 'convite sem proposta vinculada'; end if;

  update public.proposals as proposal
  set accepted_at = now(), accepted_name = v_name
  where proposal.id = v_invitation.proposal_id
    and proposal.accepted_at is null
  returning proposal.* into v_proposal;

  -- Só a primeira aceitação produz side effects. Repetir o clique é seguro.
  if found then
    insert into public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
    values (
      null,
      'proposal.accepted',
      'proposal',
      v_proposal.id,
      jsonb_build_object(
        'implementationId', v_proposal.implementation_id,
        'version', v_proposal.version,
        'source', 'owner_journey'
      )
    );

    if to_regclass('public.initial_charges') is not null then
      select
        coalesce(
          jsonb_agg(jsonb_build_object('label', term.label, 'amount', term.value) order by term.display_order),
          '[]'::jsonb
        ),
        coalesce(sum(term.value), 0)
      into v_charge_items, v_charge_amount
      from public.commercial_terms as term
      where term.implementation_id = v_proposal.implementation_id
        and term.charge_type = 'fixed_once';

      if v_charge_amount > 0 then
        insert into public.initial_charges (
          code,
          implementation_id,
          owner_id,
          proposal_id,
          items,
          amount,
          status
        ) values (
          'COB-' || replace(v_proposal.id::text, '-', ''),
          v_proposal.implementation_id,
          v_invitation.owner_id,
          v_proposal.id,
          v_charge_items,
          v_charge_amount,
          'pending'
        )
        on conflict (proposal_id) do nothing;
      end if;
    end if;
  end if;

  return query
  select * from public.owner_journey_resolve_proposal(p_token);
end;
$$;

revoke all on function public.owner_journey_accept_proposal(text, text) from public;
grant execute on function public.owner_journey_accept_proposal(text, text) to anon, authenticated;
