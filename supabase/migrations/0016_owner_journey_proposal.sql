-- Jornada única do proprietário: Proposta -> Dados -> Imóvel -> Acesso.
--
-- O convite de onboarding passa a carregar a versão EXATA da proposta
-- apresentada ao proprietário. O vínculo é congelado no momento da criação
-- do convite; criar uma nova versão depois nunca altera o que aquele link
-- mostra. Links legados permanecem válidos e podem ficar sem proposal_id.

alter table public.owner_portal_invitations
  add column if not exists proposal_id uuid references public.proposals(id) on delete restrict;

create index if not exists owner_portal_invitations_proposal_idx
  on public.owner_portal_invitations (proposal_id);

-- Convites antigos recebem a versão mais recente disponível naquele momento.
-- Se ainda não houver proposta persistida, continuam sem vínculo e o portal
-- mostra o estado "proposta em preparação" em vez de inventar dados.
update public.owner_portal_invitations as invitation
set proposal_id = candidate.id
from lateral (
  select proposal.id
  from public.proposals as proposal
  where proposal.implementation_id = invitation.implementation_id
  order by proposal.version desc, proposal.created_at desc
  limit 1
) as candidate
where invitation.proposal_id is null;

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
begin
  select * into v_invitation
  from public.owner_portal_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  limit 1;

  if not found then
    return;
  end if;
  if v_invitation.revoked_at is not null or v_invitation.expires_at < now() then
    return;
  end if;
  if v_invitation.proposal_id is null then
    return;
  end if;

  return query
  select
    proposal.id,
    proposal.implementation_id,
    proposal.version,
    proposal.items,
    proposal.total,
    proposal.accepted_at,
    proposal.accepted_name,
    proposal.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', term.id,
          'label', term.label,
          'chargeType', term.charge_type,
          'value', term.value,
          'optional', term.optional,
          'displayOrder', term.display_order,
          'notes', term.notes
        ) order by term.display_order
      )
      from public.commercial_terms as term
      where term.implementation_id = proposal.implementation_id
    ), '[]'::jsonb),
    case
      when to_regclass('public.implementation_contract_conditions') is null then null
      else (
        select to_jsonb(conditions)
        from public.implementation_contract_conditions as conditions
        where conditions.implementation_id = proposal.implementation_id
        limit 1
      )
    end
  from public.proposals as proposal
  where proposal.id = v_invitation.proposal_id
  limit 1;
end;
$$;

revoke all on function public.owner_journey_resolve_proposal(text) from public;
grant execute on function public.owner_journey_resolve_proposal(text) to anon, authenticated;

-- Aceite comercial pelo MESMO link de onboarding. É idempotente: a primeira
-- confirmação congela data e nome; cliques repetidos apenas devolvem o estado.
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
  v_name text := regexp_replace(trim(coalesce(p_accepted_name, '')), '\s+', ' ', 'g');
begin
  if length(v_name) < 3 or length(v_name) > 120 then
    raise exception 'nome de aceite inválido';
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
    and proposal.accepted_at is null;

  return query
  select * from public.owner_journey_resolve_proposal(p_token);
end;
$$;

revoke all on function public.owner_journey_accept_proposal(text, text) from public;
grant execute on function public.owner_journey_accept_proposal(text, text) to anon, authenticated;
