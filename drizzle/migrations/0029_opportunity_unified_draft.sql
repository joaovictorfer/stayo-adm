alter table public.implementation_projects
  add column if not exists draft_completed_at timestamptz;
comment on column public.implementation_projects.draft_completed_at is
  'Quando o formulário progressivo da oportunidade (origin admin_draft:*) foi concluído em "Revisão e criar implantação". Nulo = rascunho.';

-- Cria (ou devolve, pelo requestId) uma oportunidade em rascunho sem nenhum dado obrigatório.
create or replace function public.admin_create_draft_opportunity(p_data jsonb)
returns public.implementation_projects
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project public.implementation_projects%rowtype;
  v_title text := regexp_replace(trim(coalesce(p_data->>'title', '')), '\s+', ' ', 'g');
  v_code text;
  v_sequence integer;
  v_request_id uuid;
  v_responsible uuid;
  v_origin text;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para criar oportunidade';
  end if;
  if char_length(v_title) > 140 then raise exception 'título provisório inválido'; end if;
  begin
    v_request_id := nullif(trim(p_data->>'requestId'), '')::uuid;
  exception when invalid_text_representation then raise exception 'requestId inválido';
  end;
  if v_request_id is null then raise exception 'requestId obrigatório'; end if;
  begin
    v_responsible := nullif(trim(p_data->>'responsibleUserId'), '')::uuid;
  exception when invalid_text_representation then raise exception 'responsável inválido';
  end;
  if v_responsible is not null and not exists (
    select 1 from public.admin_profiles a where a.id = v_responsible and a.active
  ) then v_responsible := null; end if;

  v_origin := 'admin_draft:' || v_request_id::text;
  perform pg_advisory_xact_lock(hashtext(v_origin));
  select p.* into v_project from public.implementation_projects p where p.origin = v_origin limit 1;
  if found then return v_project; end if;

  perform pg_advisory_xact_lock(hashtext('implementation_code_sequence'));
  select coalesce(max((regexp_match(code, '^IMP-([0-9]+)$'))[1]::integer), 0) + 1
    into v_sequence from public.implementation_projects;
  v_code := 'IMP-' || lpad(v_sequence::text, 5, '0');
  if char_length(v_title) < 1 then v_title := 'Oportunidade · ' || v_code; end if;

  insert into public.implementation_projects (code, status, owner_id, nickname, responsible_user_id, origin)
  values (v_code, 'prospect', null, v_title, v_responsible, v_origin)
  returning * into v_project;
  return v_project;
end;
$$;

-- Salva contato/título da oportunidade. Tudo opcional. Só cria proprietário quando há nome.
create or replace function public.admin_save_opportunity_contact(p_implementation_id uuid, p_data jsonb)
returns public.implementation_projects
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project public.implementation_projects%rowtype;
  v_owner public.owner_records%rowtype;
  v_name text := regexp_replace(trim(coalesce(p_data->>'contactName', '')), '\s+', ' ', 'g');
  v_title text := regexp_replace(trim(coalesce(p_data->>'title', '')), '\s+', ' ', 'g');
  v_digits text := regexp_replace(coalesce(p_data->>'phone', ''), '\D', '', 'g');
  v_phone text;
  v_existing uuid;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para editar oportunidade';
  end if;
  select p.* into v_project from public.implementation_projects p where p.id = p_implementation_id for update;
  if not found then raise exception 'oportunidade não encontrada'; end if;
  if char_length(v_name) > 120 then raise exception 'nome do contato inválido'; end if;
  if char_length(v_title) > 140 then raise exception 'título provisório inválido'; end if;

  if v_digits = '' then v_phone := null;
  elsif v_digits ~ '^55[0-9]{10,11}$' then v_phone := v_digits;
  elsif v_digits ~ '^[0-9]{10,11}$' then v_phone := '55' || v_digits;
  else raise exception 'telefone inválido';
  end if;

  begin
    v_existing := nullif(trim(p_data->>'existingOwnerId'), '')::uuid;
  exception when invalid_text_representation then raise exception 'contato existente inválido';
  end;

  if char_length(v_title) > 0 then
    update public.implementation_projects set nickname = v_title where id = v_project.id;
  end if;

  if v_existing is not null and v_project.owner_id is null then
    select o.* into v_owner from public.owner_records o where o.id = v_existing;
    if not found then raise exception 'contato existente não encontrado'; end if;
    update public.implementation_projects set owner_id = v_owner.id where id = v_project.id;
    insert into public.implementation_owners (implementation_id, owner_id, role, display_order)
    values (v_project.id, v_owner.id, 'proprietario', 0) on conflict do nothing;
  elsif v_project.owner_id is null then
    if char_length(v_name) >= 2 then
      insert into public.owner_records (name, phone, lifecycle_status)
      values (v_name, v_phone, 'prospect') returning * into v_owner;
      update public.implementation_projects set owner_id = v_owner.id where id = v_project.id;
      insert into public.implementation_owners (implementation_id, owner_id, role, display_order)
      values (v_project.id, v_owner.id, 'proprietario', 0) on conflict do nothing;
    end if;
  else
    -- Proprietário já vinculado: só ajusta quando ele é exclusivo desta oportunidade e ainda prospect.
    if (char_length(v_name) >= 2 or v_phone is not null)
       and exists (select 1 from public.owner_records o where o.id = v_project.owner_id and o.lifecycle_status = 'prospect')
       and not exists (select 1 from public.implementation_projects p2 where p2.owner_id = v_project.owner_id and p2.id <> v_project.id)
    then
      update public.owner_records
         set name = case when char_length(v_name) >= 2 then v_name else name end,
             phone = coalesce(v_phone, phone)
       where id = v_project.owner_id;
    end if;
  end if;

  select p.* into v_project from public.implementation_projects p where p.id = p_implementation_id;
  return v_project;
end;
$$;

create or replace function public.admin_complete_opportunity_draft(p_implementation_id uuid)
returns public.implementation_projects
language plpgsql
security invoker
set search_path = public
as $$
declare v_project public.implementation_projects%rowtype;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para concluir oportunidade';
  end if;
  update public.implementation_projects
     set draft_completed_at = coalesce(draft_completed_at, now())
   where id = p_implementation_id
  returning * into v_project;
  if not found then raise exception 'oportunidade não encontrada'; end if;
  return v_project;
end;
$$;

revoke execute on function public.admin_create_draft_opportunity(jsonb) from public, anon;
revoke execute on function public.admin_save_opportunity_contact(uuid, jsonb) from public, anon;
revoke execute on function public.admin_complete_opportunity_draft(uuid) from public, anon;
grant execute on function public.admin_create_draft_opportunity(jsonb) to authenticated;
grant execute on function public.admin_save_opportunity_contact(uuid, jsonb) to authenticated;
grant execute on function public.admin_complete_opportunity_draft(uuid) to authenticated;