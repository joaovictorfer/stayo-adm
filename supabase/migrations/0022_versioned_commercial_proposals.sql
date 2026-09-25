-- Fase 2C — proposta comercial versionada e snapshot imutável.
--
-- Evolui a tabela public.proposals existente. Não cria segundo domínio,
-- portal público, aceite novo, cobrança ou contrato.

alter table public.proposals
  add column if not exists status text not null default 'draft',
  add column if not exists draft_revision integer not null default 1,
  add column if not exists draft_responsibilities jsonb not null default '[]'::jsonb,
  add column if not exists required_signatories jsonb not null default '[]'::jsonb,
  add column if not exists snapshot jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.admin_profiles(id),
  add column if not exists publish_command_id uuid,
  add column if not exists last_draft_command_id uuid,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.admin_profiles(id);

alter table public.proposals
  drop constraint if exists proposals_status_check;
alter table public.proposals
  add constraint proposals_status_check
  check (status in ('draft', 'published', 'accepted', 'superseded'));

alter table public.proposals
  drop constraint if exists proposals_draft_revision_check;
alter table public.proposals
  add constraint proposals_draft_revision_check check (draft_revision > 0);

create unique index if not exists proposals_one_draft_per_implementation_idx
  on public.proposals (implementation_id)
  where status = 'draft';

create unique index if not exists proposals_publish_command_uidx
  on public.proposals (publish_command_id)
  where publish_command_id is not null;

create unique index if not exists proposals_draft_command_uidx
  on public.proposals (last_draft_command_id)
  where last_draft_command_id is not null;

update public.proposals
set status = case when accepted_at is not null then 'accepted' else status end,
    updated_at = coalesce(updated_at, created_at)
where accepted_at is not null;

alter table public.proposals enable row level security;

drop policy if exists "comercial gerencia propostas" on public.proposals;
drop policy if exists "time interno lê propostas" on public.proposals;
drop policy if exists "proprietario le propostas dos proprios imoveis" on public.proposals;
drop policy if exists "proprietário lê as próprias propostas" on public.proposals;

create policy "comercial le propostas"
  on public.proposals
  for select
  to authenticated
  using (public.has_admin_role('super_admin', 'admin', 'commercial') is true);

revoke all on table public.proposals from public, anon, authenticated;
revoke all on table public.proposals from sandbox_exec;
grant select on table public.proposals to authenticated;
grant select, insert, update, delete on table public.proposals to service_role;

create or replace function public.admin_list_proposal_versions(p_implementation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para consultar propostas';
  end if;

  if not exists (select 1 from public.implementation_projects where id = p_implementation_id) then
    raise exception 'oportunidade não encontrada';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'implementationId', p.implementation_id,
    'version', p.version,
    'status', p.status,
    'items', p.items,
    'total', p.total,
    'draftResponsibilities', p.draft_responsibilities,
    'requiredSignatories', p.required_signatories,
    'snapshot', p.snapshot,
    'draftRevision', p.draft_revision,
    'publishedAt', p.published_at,
    'publishedBy', p.published_by,
    'acceptedAt', p.accepted_at,
    'acceptedName', p.accepted_name,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  ) order by p.version desc), '[]'::jsonb)
  into v_result
  from public.proposals p
  where p.implementation_id = p_implementation_id;

  return v_result;
end;
$$;

create or replace function public.admin_save_proposal_draft(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_implementation_id uuid;
  v_proposal_id uuid;
  v_command_id uuid;
  v_expected_revision integer;
  v_items_input jsonb := coalesce(p_data->'items', '[]'::jsonb);
  v_responsibilities jsonb := coalesce(p_data->'responsibilities', '[]'::jsonb);
  v_signatories jsonb := coalesce(p_data->'requiredSignatories', '[]'::jsonb);
  v_items jsonb;
  v_total numeric;
  v_version integer;
  v_proposal public.proposals%rowtype;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para editar proposta';
  end if;

  begin
    v_implementation_id := (p_data->>'implementationId')::uuid;
    v_command_id := (p_data->>'commandId')::uuid;
    v_proposal_id := nullif(p_data->>'proposalId', '')::uuid;
    v_expected_revision := nullif(p_data->>'expectedRevision', '')::integer;
  exception when others then
    raise exception 'dados da proposta inválidos';
  end;

  if not exists (select 1 from public.implementation_projects where id = v_implementation_id) then
    raise exception 'oportunidade não encontrada';
  end if;
  if jsonb_typeof(v_items_input) <> 'array' or jsonb_array_length(v_items_input) = 0 then
    raise exception 'adicione ao menos um item à proposta';
  end if;
  if jsonb_typeof(v_responsibilities) <> 'array' then
    raise exception 'responsabilidades inválidas';
  end if;
  if jsonb_typeof(v_signatories) <> 'array' then
    raise exception 'signatários inválidos';
  end if;

  begin
    select jsonb_agg(jsonb_build_object(
      'description', q.description,
      'quantity', q.quantity,
      'unitValue', q.unit_value,
      'discount', q.discount,
      'total', greatest(0, q.quantity * q.unit_value - q.discount)
    ) order by q.ord),
    coalesce(sum(greatest(0, q.quantity * q.unit_value - q.discount)), 0)
    into v_items, v_total
    from (
      select
        ord,
        regexp_replace(trim(value->>'description'), '\s+', ' ', 'g') as description,
        (value->>'quantity')::numeric as quantity,
        (value->>'unitValue')::numeric as unit_value,
        coalesce((value->>'discount')::numeric, 0) as discount
      from jsonb_array_elements(v_items_input) with ordinality as e(value, ord)
    ) q
    where char_length(q.description) between 1 and 240
      and q.quantity > 0
      and q.unit_value >= 0
      and q.discount >= 0;
  exception when others then
    raise exception 'itens da proposta inválidos';
  end;

  if v_items is null or jsonb_array_length(v_items) <> jsonb_array_length(v_items_input) then
    raise exception 'itens da proposta inválidos';
  end if;

  perform pg_advisory_xact_lock(hashtext('proposal_draft:' || v_implementation_id::text));

  select * into v_proposal from public.proposals where last_draft_command_id = v_command_id;
  if found then
    return (public.admin_list_proposal_versions(v_implementation_id)->0);
  end if;

  if v_proposal_id is not null then
    select * into v_proposal from public.proposals where id = v_proposal_id for update;
    if not found or v_proposal.implementation_id <> v_implementation_id then
      raise exception 'draft não encontrado';
    end if;
    if v_proposal.status <> 'draft' then
      raise exception 'versão publicada é imutável; crie uma nova versão';
    end if;
    if v_expected_revision is null or v_proposal.draft_revision <> v_expected_revision then
      raise exception 'conflito de edição; recarregue a proposta';
    end if;

    update public.proposals
    set items = v_items,
        total = v_total,
        draft_responsibilities = v_responsibilities,
        required_signatories = v_signatories,
        draft_revision = draft_revision + 1,
        last_draft_command_id = v_command_id,
        updated_at = now(),
        updated_by = v_actor
    where id = v_proposal.id
    returning * into v_proposal;
  else
    select * into v_proposal
    from public.proposals
    where implementation_id = v_implementation_id and status = 'draft'
    order by version desc
    limit 1
    for update;

    if found then
      update public.proposals
      set items = v_items,
          total = v_total,
          draft_responsibilities = v_responsibilities,
          required_signatories = v_signatories,
          draft_revision = draft_revision + 1,
          last_draft_command_id = v_command_id,
          updated_at = now(),
          updated_by = v_actor
      where id = v_proposal.id
      returning * into v_proposal;
    else
      select coalesce(max(version), 0) + 1 into v_version
      from public.proposals
      where implementation_id = v_implementation_id;

      insert into public.proposals (
        implementation_id, version, items, total, status,
        draft_responsibilities, required_signatories,
        draft_revision, last_draft_command_id, updated_by
      ) values (
        v_implementation_id, v_version, v_items, v_total, 'draft',
        v_responsibilities, v_signatories,
        1, v_command_id, v_actor
      ) returning * into v_proposal;
    end if;
  end if;

  return (select elem from jsonb_array_elements(public.admin_list_proposal_versions(v_implementation_id)) elem where (elem->>'id')::uuid = v_proposal.id limit 1);
end;
$$;

create or replace function public.admin_publish_proposal(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_proposal_id uuid;
  v_command_id uuid;
  v_expected_revision integer;
  v_proposal public.proposals%rowtype;
  v_snapshot jsonb;
  v_now timestamptz := now();
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para publicar proposta';
  end if;

  begin
    v_proposal_id := (p_data->>'proposalId')::uuid;
    v_command_id := (p_data->>'commandId')::uuid;
    v_expected_revision := (p_data->>'expectedRevision')::integer;
  exception when others then
    raise exception 'comando de publicação inválido';
  end;

  perform pg_advisory_xact_lock(hashtext('proposal_publish:' || v_proposal_id::text));

  select * into v_proposal from public.proposals where publish_command_id = v_command_id;
  if found then
    return (select elem from jsonb_array_elements(public.admin_list_proposal_versions(v_proposal.implementation_id)) elem where (elem->>'id')::uuid = v_proposal.id limit 1);
  end if;

  select * into v_proposal from public.proposals where id = v_proposal_id for update;
  if not found then raise exception 'proposta não encontrada'; end if;
  if v_proposal.status <> 'draft' then raise exception 'somente draft pode ser publicado'; end if;
  if v_proposal.draft_revision <> v_expected_revision then raise exception 'conflito de edição; recarregue a proposta'; end if;
  if jsonb_array_length(v_proposal.items) = 0 then raise exception 'proposta sem itens'; end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'proposalId', v_proposal.id,
    'implementationId', v_proposal.implementation_id,
    'version', v_proposal.version,
    'opportunity', jsonb_build_object(
      'code', ip.code,
      'title', ip.nickname
    ),
    'items', v_proposal.items,
    'total', v_proposal.total,
    'commercialTerms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', ct.label,
        'chargeType', ct.charge_type,
        'value', ct.value,
        'optional', ct.optional,
        'displayOrder', ct.display_order,
        'notes', ct.notes
      ) order by ct.display_order, ct.label)
      from public.commercial_terms ct
      where ct.implementation_id = v_proposal.implementation_id
    ), '[]'::jsonb),
    'contractConditions', coalesce((
      select jsonb_build_object(
        'administrationFee', cc.administration_fee,
        'cleaningResponsibility', cc.cleaning_responsibility,
        'payoutRule', cc.payout_rule,
        'maintenanceLimit', cc.maintenance_limit,
        'exclusivity', cc.exclusivity,
        'durationMonths', cc.duration_months,
        'noticePeriodDays', cc.notice_period_days
      )
      from public.implementation_contract_conditions cc
      where cc.implementation_id = v_proposal.implementation_id
    ), '{}'::jsonb),
    'responsibilities', v_proposal.draft_responsibilities,
    'content', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', pcb.title,
        'body', pcb.body,
        'displayOrder', pcb.display_order
      ) order by pcb.display_order, pcb.created_at)
      from public.proposal_content_blocks pcb
      where pcb.implementation_id = v_proposal.implementation_id
        and pcb.visibility = 'proposta'
    ), '[]'::jsonb),
    'requiredSignatories', v_proposal.required_signatories,
    'publishedAt', v_now
  ) into v_snapshot
  from public.implementation_projects ip
  where ip.id = v_proposal.implementation_id;

  update public.proposals
  set status = 'superseded', updated_at = v_now, updated_by = v_actor
  where implementation_id = v_proposal.implementation_id
    and id <> v_proposal.id
    and status = 'published';

  update public.proposals
  set status = 'published',
      snapshot = v_snapshot,
      published_at = v_now,
      published_by = v_actor,
      publish_command_id = v_command_id,
      updated_at = v_now,
      updated_by = v_actor
  where id = v_proposal.id
  returning * into v_proposal;

  return (select elem from jsonb_array_elements(public.admin_list_proposal_versions(v_proposal.implementation_id)) elem where (elem->>'id')::uuid = v_proposal.id limit 1);
end;
$$;

create or replace function public.protect_published_proposal_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status in ('published', 'superseded', 'accepted') then
    if new.implementation_id is distinct from old.implementation_id
       or new.version is distinct from old.version
       or new.items is distinct from old.items
       or new.total is distinct from old.total
       or new.draft_responsibilities is distinct from old.draft_responsibilities
       or new.required_signatories is distinct from old.required_signatories
       or new.snapshot is distinct from old.snapshot
       or new.published_at is distinct from old.published_at
       or new.published_by is distinct from old.published_by
       or new.publish_command_id is distinct from old.publish_command_id then
      raise exception 'versão publicada é imutável';
    end if;
    if old.status = 'accepted' and (
      new.status is distinct from old.status
      or new.accepted_at is distinct from old.accepted_at
      or new.accepted_name is distinct from old.accepted_name
    ) then
      raise exception 'versão aceita é imutável';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_published_proposal_snapshot on public.proposals;
create trigger protect_published_proposal_snapshot
before update on public.proposals
for each row execute function public.protect_published_proposal_snapshot();

-- Compatibilidade segura do fluxo legado: tokens nunca resolvem drafts.
create or replace function public.proposal_resolve_by_token(p_token text)
returns table(
  proposal_id uuid, implementation_id uuid, version integer, items jsonb,
  total numeric, accepted_at timestamptz, accepted_name text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p.id, p.implementation_id, p.version, p.items, p.total,
         p.accepted_at, p.accepted_name, p.created_at
  from public.proposal_share_links l
  join public.proposals p on p.id = l.proposal_id
  where l.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and p.status in ('published', 'accepted', 'superseded')
  limit 1;
$$;

create or replace function public.proposal_accept_by_token(p_token text, p_accepted_name text)
returns table(
  proposal_id uuid, implementation_id uuid, version integer, items jsonb,
  total numeric, accepted_at timestamptz, accepted_name text, created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.proposal_share_links%rowtype;
  v_proposal public.proposals%rowtype;
begin
  select * into v_link
  from public.proposal_share_links
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if not found then raise exception 'proposta não encontrada'; end if;

  update public.proposals pr
  set accepted_at = now(), accepted_name = p_accepted_name, status = 'accepted'
  where pr.id = v_link.proposal_id
    and pr.status = 'published'
    and pr.accepted_at is null
  returning pr.* into v_proposal;

  if not found then
    select * into v_proposal
    from public.proposals pr
    where pr.id = v_link.proposal_id
      and pr.status in ('accepted', 'superseded');
  end if;

  if not found then raise exception 'proposta não disponível para aceite'; end if;

  return query
    select v_proposal.id, v_proposal.implementation_id, v_proposal.version,
           v_proposal.items, v_proposal.total, v_proposal.accepted_at,
           v_proposal.accepted_name, v_proposal.created_at;
end;
$$;

revoke all on function public.admin_list_proposal_versions(uuid) from public, anon;
revoke all on function public.admin_save_proposal_draft(jsonb) from public, anon;
revoke all on function public.admin_publish_proposal(jsonb) from public, anon;
grant execute on function public.admin_list_proposal_versions(uuid) to authenticated;
grant execute on function public.admin_save_proposal_draft(jsonb) to authenticated;
grant execute on function public.admin_publish_proposal(jsonb) to authenticated;
