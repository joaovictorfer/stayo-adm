-- Fase 1 — oportunidade comercial leve.
--
-- Esta migration NÃO cria uma nova fonte de verdade. Reaproveita
-- owner_records + implementation_projects e adiciona somente RPCs para:
--   1) detectar possível duplicidade por telefone normalizado;
--   2) criar owner + opportunity de forma transacional e idempotente.
--
-- IMPORTANTE: o banco Lovable Cloud atual foi auditado antes desta migration.
-- `implementation_projects` já aceita os campos de imóvel como NULL e mantém
-- `code` UNIQUE; o RPC histórico `admin_create_implementation` é que ainda
-- exige condomínio/unidade. Este novo RPC é isolado para não alterar o fluxo
-- legado de implantações completas.

create or replace function public.admin_find_owner_phone_duplicates(p_phone text)
returns table (
  id uuid,
  name text,
  phone text,
  lifecycle_status text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_normalized text;
begin
  if not public.has_admin_role('super_admin', 'admin', 'commercial') then
    raise exception 'sem permissão para consultar contatos comerciais';
  end if;

  if v_digits ~ '^55[0-9]{10,11}$' then
    v_normalized := v_digits;
  elsif v_digits ~ '^[0-9]{10,11}$' then
    v_normalized := '55' || v_digits;
  else
    return;
  end if;

  return query
    select o.id, o.name, o.phone, o.lifecycle_status
    from public.owner_records o
    where case
      when regexp_replace(coalesce(o.phone, ''), '\D', '', 'g') ~ '^55[0-9]{10,11}$'
        then regexp_replace(coalesce(o.phone, ''), '\D', '', 'g')
      when regexp_replace(coalesce(o.phone, ''), '\D', '', 'g') ~ '^[0-9]{10,11}$'
        then '55' || regexp_replace(coalesce(o.phone, ''), '\D', '', 'g')
      else regexp_replace(coalesce(o.phone, ''), '\D', '', 'g')
    end = v_normalized
    order by o.created_at desc;
end;
$$;

revoke all on function public.admin_find_owner_phone_duplicates(text) from public;
grant execute on function public.admin_find_owner_phone_duplicates(text) to authenticated;

create or replace function public.admin_create_opportunity(p_data jsonb)
returns public.implementation_projects
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project public.implementation_projects%rowtype;
  v_owner public.owner_records%rowtype;
  v_code text;
  v_sequence integer;
  v_contact_name text := regexp_replace(trim(coalesce(p_data->>'contactName', '')), '\s+', ' ', 'g');
  v_title text := regexp_replace(trim(coalesce(p_data->>'title', '')), '\s+', ' ', 'g');
  v_phone_digits text := regexp_replace(coalesce(p_data->>'phone', ''), '\D', '', 'g');
  v_phone text;
  v_existing_owner_id uuid;
  v_responsible_user_id uuid;
  v_request_id uuid;
  v_origin text;
begin
  if not public.has_admin_role('super_admin', 'admin', 'commercial') then
    raise exception 'sem permissão para criar oportunidade';
  end if;

  if char_length(v_contact_name) < 3 or char_length(v_contact_name) > 120 then
    raise exception 'nome do contato inválido';
  end if;

  if char_length(v_title) < 3 or char_length(v_title) > 140 then
    raise exception 'título provisório inválido';
  end if;

  if v_phone_digits ~ '^55[0-9]{10,11}$' then
    v_phone := v_phone_digits;
  elsif v_phone_digits ~ '^[0-9]{10,11}$' then
    v_phone := '55' || v_phone_digits;
  else
    raise exception 'telefone inválido';
  end if;

  begin
    v_request_id := nullif(trim(p_data->>'requestId'), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'requestId inválido';
  end;
  if v_request_id is null then
    raise exception 'requestId obrigatório';
  end if;

  v_origin := 'admin_opportunity:' || v_request_id::text;
  perform pg_advisory_xact_lock(hashtext(v_origin));

  -- Retry/duplo clique com o MESMO requestId devolve o mesmo registro.
  select p.* into v_project
  from public.implementation_projects p
  where p.origin = v_origin
  limit 1;
  if found then
    return v_project;
  end if;

  begin
    v_existing_owner_id := nullif(trim(p_data->>'existingOwnerId'), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'contato existente inválido';
  end;

  begin
    v_responsible_user_id := nullif(trim(p_data->>'responsibleUserId'), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'responsável inválido';
  end;

  if v_existing_owner_id is not null then
    select o.* into v_owner
    from public.owner_records o
    where o.id = v_existing_owner_id;
    if not found then
      raise exception 'contato existente não encontrado';
    end if;
  else
    insert into public.owner_records (
      name,
      phone,
      lifecycle_status
    ) values (
      v_contact_name,
      v_phone,
      'prospect'
    )
    returning * into v_owner;
  end if;

  -- A numeração continua usando o mecanismo já adotado no Admin: geração
  -- server-side sob lock transacional + UNIQUE(code).
  perform pg_advisory_xact_lock(hashtext('implementation_code_sequence'));
  select coalesce(max((regexp_match(code, '^IMP-([0-9]+)$'))[1]::integer), 0) + 1
    into v_sequence
  from public.implementation_projects;
  v_code := 'IMP-' || lpad(v_sequence::text, 5, '0');

  insert into public.implementation_projects (
    code,
    status,
    owner_id,
    nickname,
    responsible_user_id,
    origin
  ) values (
    v_code,
    'prospect',
    v_owner.id,
    v_title,
    v_responsible_user_id,
    v_origin
  )
  returning * into v_project;

  insert into public.implementation_owners (
    implementation_id,
    owner_id,
    role,
    display_order
  ) values (
    v_project.id,
    v_owner.id,
    'proprietario',
    0
  )
  on conflict do nothing;

  return v_project;
end;
$$;

revoke all on function public.admin_create_opportunity(jsonb) from public;
grant execute on function public.admin_create_opportunity(jsonb) to authenticated;
