alter table public.implementation_projects
  add column if not exists draft_step text,
  add column if not exists owner_facing_notes text;
comment on column public.implementation_projects.owner_facing_notes is
  'Informações da conversa que PODERÃO ser exibidas ao proprietário. Nunca públicas por padrão: exibição depende de liberação.';
comment on column public.implementation_projects.draft_step is 'Última etapa aberta no formulário da oportunidade.';

create table if not exists public.implementation_field_sources (
  implementation_id uuid not null references public.implementation_projects(id) on delete cascade,
  field text not null,
  source text not null check (source in ('admin','owner')),
  actor_id uuid,
  updated_at timestamptz not null default now(),
  primary key (implementation_id, field)
);
grant select on public.implementation_field_sources to authenticated;
grant all on public.implementation_field_sources to service_role;
alter table public.implementation_field_sources enable row level security;
create policy "equipe lê origem dos campos" on public.implementation_field_sources
  for select to authenticated using (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));

-- Registra quem forneceu cada campo em qualquer alteração (equipe ou proprietário).
create or replace function public.track_implementation_field_sources()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_src text := case when public.has_admin_role('super_admin','admin','commercial','operations','finance') then 'admin' else 'owner' end;
begin
  foreach f in array array['nickname','condominium_name','tower','unit','address','city','postal_code','property_type','bedrooms','capacity','notes','owner_facing_notes','cover_source'] loop
    if (v_old->f) is distinct from (v_new->f) then
      insert into public.implementation_field_sources (implementation_id, field, source, actor_id, updated_at)
      values (new.id, f, v_src, auth.uid(), now())
      on conflict (implementation_id, field) do update
        set source = excluded.source, actor_id = excluded.actor_id, updated_at = excluded.updated_at;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists implementation_field_sources_trg on public.implementation_projects;
create trigger implementation_field_sources_trg after update on public.implementation_projects
  for each row execute function public.track_implementation_field_sources();

-- Autosave da equipe com detecção de conflito por campo (base = valor que a tela carregou).
create or replace function public.admin_autosave_opportunity(p_implementation_id uuid, p_patch jsonb, p_base jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_row public.implementation_projects%rowtype;
  v_cur jsonb;
  f text;
  v_allowed text[] := array['nickname','condominium_name','tower','unit','address','city','postal_code','property_type','bedrooms','capacity','notes','owner_facing_notes','draft_step'];
  v_conflicts jsonb := '[]'::jsonb;
  v_apply jsonb := '{}'::jsonb;
begin
  if public.has_admin_role('super_admin','admin','commercial') is not true then
    raise exception 'sem permissão para editar oportunidade';
  end if;
  select * into v_row from public.implementation_projects where id = p_implementation_id for update;
  if not found then raise exception 'oportunidade não encontrada'; end if;
  v_cur := to_jsonb(v_row);
  for f in select jsonb_object_keys(p_patch) loop
    if not (f = any(v_allowed)) then raise exception 'campo não permitido: %', f; end if;
    if f <> 'draft_step' and p_base ? f
       and (v_cur->f) is distinct from (p_base->f)
       and (v_cur->f) is distinct from (p_patch->f) then
      v_conflicts := v_conflicts || jsonb_build_object('field', f, 'current', v_cur->f, 'mine', p_patch->f);
    else
      v_apply := v_apply || jsonb_build_object(f, p_patch->f);
    end if;
  end loop;
  if v_apply <> '{}'::jsonb then
    update public.implementation_projects p set
      nickname = case when v_apply ? 'nickname' then nullif(v_apply->>'nickname','') else p.nickname end,
      condominium_name = case when v_apply ? 'condominium_name' then nullif(v_apply->>'condominium_name','') else p.condominium_name end,
      tower = case when v_apply ? 'tower' then nullif(v_apply->>'tower','') else p.tower end,
      unit = case when v_apply ? 'unit' then nullif(v_apply->>'unit','') else p.unit end,
      address = case when v_apply ? 'address' then nullif(v_apply->>'address','') else p.address end,
      city = case when v_apply ? 'city' then nullif(v_apply->>'city','') else p.city end,
      postal_code = case when v_apply ? 'postal_code' then nullif(v_apply->>'postal_code','') else p.postal_code end,
      property_type = case when v_apply ? 'property_type' then nullif(v_apply->>'property_type','') else p.property_type end,
      bedrooms = case when v_apply ? 'bedrooms' then nullif(v_apply->>'bedrooms','')::int else p.bedrooms end,
      capacity = case when v_apply ? 'capacity' then nullif(v_apply->>'capacity','')::int else p.capacity end,
      notes = case when v_apply ? 'notes' then nullif(v_apply->>'notes','') else p.notes end,
      owner_facing_notes = case when v_apply ? 'owner_facing_notes' then nullif(v_apply->>'owner_facing_notes','') else p.owner_facing_notes end,
      draft_step = case when v_apply ? 'draft_step' then nullif(v_apply->>'draft_step','') else p.draft_step end
    where p.id = p_implementation_id
    returning * into v_row;
  end if;
  return jsonb_build_object('row', to_jsonb(v_row), 'conflicts', v_conflicts);
end;
$$;
revoke execute on function public.admin_autosave_opportunity(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_autosave_opportunity(uuid, jsonb, jsonb) to authenticated;