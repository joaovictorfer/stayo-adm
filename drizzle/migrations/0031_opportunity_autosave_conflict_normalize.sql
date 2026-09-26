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
    -- Conflito só quando o valor no banco mudou desde que a tela carregou (vazio = nulo).
    if f <> 'draft_step' and p_base ? f
       and coalesce(v_cur->>f, '') <> coalesce(p_base->>f, '')
       and coalesce(v_cur->>f, '') <> coalesce(p_patch->>f, '') then
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