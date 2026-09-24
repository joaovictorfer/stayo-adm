-- Fase 2B — reunião comercial estruturada e próxima ação.
--
-- Reaproveita implementation_projects como agregado da oportunidade/implantação.
-- Não cria CRM paralelo, calendário no Core, Property operacional ou superfície pública.
-- Escritas são feitas somente por RPCs com autorização server-side, validação,
-- idempotência por commandId e optimistic concurrency por version.

create table if not exists public.implementation_commercial_meetings (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references public.implementation_projects(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  time_zone text not null,
  mode text not null check (mode in ('video', 'in_person')),
  join_url text,
  status text not null check (status in ('scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  responsible_user_id uuid not null references public.admin_profiles(id),
  rescheduled_from_id uuid references public.implementation_commercial_meetings(id),
  command_id uuid not null unique,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.admin_profiles(id),
  updated_by uuid not null references public.admin_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint implementation_commercial_meetings_end_after_start
    check (ends_at is null or ends_at > starts_at),
  constraint implementation_commercial_meetings_video_url
    check (join_url is null or mode = 'video')
);

create index if not exists implementation_commercial_meetings_implementation_idx
  on public.implementation_commercial_meetings (implementation_id, created_at desc);

create unique index if not exists implementation_commercial_meetings_one_active_idx
  on public.implementation_commercial_meetings (implementation_id)
  where status in ('scheduled', 'confirmed');

create table if not exists public.implementation_commercial_meeting_events (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.implementation_commercial_meetings(id) on delete cascade,
  implementation_id uuid not null references public.implementation_projects(id) on delete cascade,
  event_type text not null check (event_type in ('scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  from_status text check (from_status is null or from_status in ('scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  to_status text not null check (to_status in ('scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  time_zone text not null,
  mode text not null check (mode in ('video', 'in_person')),
  responsible_user_id uuid not null references public.admin_profiles(id),
  replacement_meeting_id uuid references public.implementation_commercial_meetings(id),
  actor_id uuid not null references public.admin_profiles(id),
  command_id uuid not null unique,
  created_at timestamptz not null default now()
);

create index if not exists implementation_commercial_meeting_events_impl_idx
  on public.implementation_commercial_meeting_events (implementation_id, created_at desc);

create table if not exists public.implementation_next_actions (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references public.implementation_projects(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  time_zone text not null,
  responsible_user_id uuid references public.admin_profiles(id),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'superseded')),
  command_id uuid not null unique,
  closed_command_id uuid unique,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.admin_profiles(id),
  updated_by uuid not null references public.admin_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists implementation_next_actions_implementation_idx
  on public.implementation_next_actions (implementation_id, created_at desc);

create unique index if not exists implementation_next_actions_one_active_idx
  on public.implementation_next_actions (implementation_id)
  where status = 'active';

alter table public.implementation_commercial_meetings enable row level security;
alter table public.implementation_commercial_meeting_events enable row level security;
alter table public.implementation_next_actions enable row level security;

drop policy if exists "commercial staff le reunioes" on public.implementation_commercial_meetings;
create policy "commercial staff le reunioes"
  on public.implementation_commercial_meetings
  for select
  to authenticated
  using (public.has_admin_role('super_admin', 'admin', 'commercial') is true);

drop policy if exists "commercial staff le historico de reunioes" on public.implementation_commercial_meeting_events;
create policy "commercial staff le historico de reunioes"
  on public.implementation_commercial_meeting_events
  for select
  to authenticated
  using (public.has_admin_role('super_admin', 'admin', 'commercial') is true);

drop policy if exists "commercial staff le proximas acoes" on public.implementation_next_actions;
create policy "commercial staff le proximas acoes"
  on public.implementation_next_actions
  for select
  to authenticated
  using (public.has_admin_role('super_admin', 'admin', 'commercial') is true);

revoke all on table public.implementation_commercial_meetings from public, anon, authenticated;
revoke all on table public.implementation_commercial_meeting_events from public, anon, authenticated;
revoke all on table public.implementation_next_actions from public, anon, authenticated;
revoke all on table public.implementation_commercial_meetings from sandbox_exec;
revoke all on table public.implementation_commercial_meeting_events from sandbox_exec;
revoke all on table public.implementation_next_actions from sandbox_exec;

grant select on table public.implementation_commercial_meetings to authenticated;
grant select on table public.implementation_commercial_meeting_events to authenticated;
grant select on table public.implementation_next_actions to authenticated;
grant select, insert, update, delete on table public.implementation_commercial_meetings to service_role;
grant select, insert, update, delete on table public.implementation_commercial_meeting_events to service_role;
grant select, insert, update, delete on table public.implementation_next_actions to service_role;

create or replace function public.admin_list_commercial_assignees()
returns table (
  id uuid,
  full_name text,
  role public.admin_role
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para consultar responsáveis comerciais';
  end if;

  return query
    select ap.id, ap.full_name, ap.role
    from public.admin_profiles ap
    where ap.active is true
      and ap.role in ('super_admin', 'admin', 'commercial', 'operations')
    order by ap.full_name;
end;
$$;

create or replace function public.admin_get_commercial_meeting_state(p_implementation_id uuid)
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
    raise exception 'sem permissão para consultar reunião comercial';
  end if;

  if not exists (select 1 from public.implementation_projects p where p.id = p_implementation_id) then
    raise exception 'oportunidade não encontrada';
  end if;

  select jsonb_build_object(
    'currentMeeting', (
      select jsonb_build_object(
        'id', m.id,
        'implementationId', m.implementation_id,
        'startsAt', m.starts_at,
        'endsAt', m.ends_at,
        'timeZone', m.time_zone,
        'mode', m.mode,
        'joinUrl', m.join_url,
        'status', m.status,
        'responsibleUserId', m.responsible_user_id,
        'responsibleName', ap.full_name,
        'rescheduledFromId', m.rescheduled_from_id,
        'version', m.version,
        'createdBy', m.created_by,
        'updatedBy', m.updated_by,
        'createdAt', m.created_at,
        'updatedAt', m.updated_at
      )
      from public.implementation_commercial_meetings m
      join public.admin_profiles ap on ap.id = m.responsible_user_id
      where m.implementation_id = p_implementation_id
        and m.status in ('scheduled', 'confirmed')
      order by m.created_at desc
      limit 1
    ),
    'meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'implementationId', m.implementation_id,
        'startsAt', m.starts_at,
        'endsAt', m.ends_at,
        'timeZone', m.time_zone,
        'mode', m.mode,
        'joinUrl', m.join_url,
        'status', m.status,
        'responsibleUserId', m.responsible_user_id,
        'responsibleName', ap.full_name,
        'rescheduledFromId', m.rescheduled_from_id,
        'version', m.version,
        'createdBy', m.created_by,
        'updatedBy', m.updated_by,
        'createdAt', m.created_at,
        'updatedAt', m.updated_at
      ) order by m.created_at desc)
      from public.implementation_commercial_meetings m
      join public.admin_profiles ap on ap.id = m.responsible_user_id
      where m.implementation_id = p_implementation_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'meetingId', e.meeting_id,
        'implementationId', e.implementation_id,
        'eventType', e.event_type,
        'fromStatus', e.from_status,
        'toStatus', e.to_status,
        'startsAt', e.starts_at,
        'endsAt', e.ends_at,
        'timeZone', e.time_zone,
        'mode', e.mode,
        'responsibleUserId', e.responsible_user_id,
        'responsibleName', ap.full_name,
        'replacementMeetingId', e.replacement_meeting_id,
        'actorId', e.actor_id,
        'createdAt', e.created_at
      ) order by e.created_at desc)
      from public.implementation_commercial_meeting_events e
      join public.admin_profiles ap on ap.id = e.responsible_user_id
      where e.implementation_id = p_implementation_id
    ), '[]'::jsonb),
    'nextAction', (
      select jsonb_build_object(
        'id', a.id,
        'implementationId', a.implementation_id,
        'title', a.title,
        'dueAt', a.due_at,
        'timeZone', a.time_zone,
        'responsibleUserId', a.responsible_user_id,
        'responsibleName', rap.full_name,
        'status', a.status,
        'version', a.version,
        'createdBy', a.created_by,
        'updatedBy', a.updated_by,
        'createdAt', a.created_at,
        'updatedAt', a.updated_at,
        'closedAt', a.closed_at
      )
      from public.implementation_next_actions a
      left join public.admin_profiles rap on rap.id = a.responsible_user_id
      where a.implementation_id = p_implementation_id
        and a.status = 'active'
      order by a.created_at desc
      limit 1
    ),
    'actionHistory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'implementationId', a.implementation_id,
        'title', a.title,
        'dueAt', a.due_at,
        'timeZone', a.time_zone,
        'responsibleUserId', a.responsible_user_id,
        'responsibleName', rap.full_name,
        'status', a.status,
        'version', a.version,
        'createdAt', a.created_at,
        'updatedAt', a.updated_at,
        'closedAt', a.closed_at
      ) order by a.created_at desc)
      from public.implementation_next_actions a
      left join public.admin_profiles rap on rap.id = a.responsible_user_id
      where a.implementation_id = p_implementation_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_list_commercial_overview()
returns table (
  implementation_id uuid,
  meeting_starts_at timestamptz,
  meeting_time_zone text,
  meeting_mode text,
  meeting_status text,
  meeting_responsible_user_id uuid,
  meeting_responsible_name text,
  next_action_title text,
  next_action_due_at timestamptz,
  next_action_time_zone text,
  next_action_responsible_user_id uuid,
  next_action_responsible_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para consultar agenda comercial';
  end if;

  return query
    select
      p.id,
      m.starts_at,
      m.time_zone,
      m.mode,
      m.status,
      m.responsible_user_id,
      map.full_name,
      a.title,
      a.due_at,
      a.time_zone,
      a.responsible_user_id,
      aap.full_name
    from public.implementation_projects p
    left join lateral (
      select cm.*
      from public.implementation_commercial_meetings cm
      where cm.implementation_id = p.id
        and cm.status in ('scheduled', 'confirmed')
      order by cm.created_at desc
      limit 1
    ) m on true
    left join public.admin_profiles map on map.id = m.responsible_user_id
    left join lateral (
      select na.*
      from public.implementation_next_actions na
      where na.implementation_id = p.id
        and na.status = 'active'
      order by na.created_at desc
      limit 1
    ) a on true
    left join public.admin_profiles aap on aap.id = a.responsible_user_id;
end;
$$;

create or replace function public.admin_schedule_commercial_meeting(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_implementation_id uuid;
  v_responsible_id uuid;
  v_command_id uuid;
  v_time_zone text := trim(coalesce(p_data->>'timeZone', ''));
  v_mode text := trim(coalesce(p_data->>'mode', ''));
  v_join_url text := nullif(trim(coalesce(p_data->>'joinUrl', '')), '');
  v_starts_local timestamp;
  v_starts_at timestamptz;
  v_meeting public.implementation_commercial_meetings%rowtype;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para agendar reunião comercial';
  end if;

  if coalesce(p_data->>'startsAtLocal', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$' then
    raise exception 'data da reunião inválida';
  end if;

  begin
    v_implementation_id := (p_data->>'implementationId')::uuid;
    v_responsible_id := (p_data->>'responsibleUserId')::uuid;
    v_command_id := (p_data->>'commandId')::uuid;
    v_starts_local := (p_data->>'startsAtLocal')::timestamp;
  exception when others then
    raise exception 'dados de agendamento inválidos';
  end;

  if not exists (select 1 from public.implementation_projects where id = v_implementation_id) then
    raise exception 'oportunidade não encontrada';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_time_zone) then
    raise exception 'fuso horário inválido';
  end if;
  if v_mode not in ('video', 'in_person') then
    raise exception 'formato de reunião inválido';
  end if;
  if v_join_url is not null and (v_mode <> 'video' or v_join_url !~* '^https://[^[:space:]]+$') then
    raise exception 'link de videochamada inválido';
  end if;
  if not exists (
    select 1 from public.admin_profiles ap
    where ap.id = v_responsible_id and ap.active is true
      and ap.role in ('super_admin', 'admin', 'commercial', 'operations')
  ) then
    raise exception 'responsável interno inválido';
  end if;

  perform pg_advisory_xact_lock(hashtext('commercial_meeting:' || v_implementation_id::text));

  select * into v_meeting
  from public.implementation_commercial_meetings
  where command_id = v_command_id;
  if found then
    return public.admin_get_commercial_meeting_state(v_implementation_id);
  end if;

  if exists (
    select 1 from public.implementation_commercial_meetings
    where implementation_id = v_implementation_id and status in ('scheduled', 'confirmed')
  ) then
    raise exception 'já existe reunião ativa para esta oportunidade';
  end if;

  v_starts_at := v_starts_local at time zone v_time_zone;
  if v_starts_at <= now() then
    raise exception 'a reunião deve ser agendada para uma data futura';
  end if;

  insert into public.implementation_commercial_meetings (
    implementation_id, starts_at, time_zone, mode, join_url, status,
    responsible_user_id, command_id, created_by, updated_by
  ) values (
    v_implementation_id, v_starts_at, v_time_zone, v_mode,
    case when v_mode = 'video' then v_join_url else null end,
    'scheduled', v_responsible_id, v_command_id, v_actor, v_actor
  ) returning * into v_meeting;

  insert into public.implementation_commercial_meeting_events (
    meeting_id, implementation_id, event_type, from_status, to_status,
    starts_at, ends_at, time_zone, mode, responsible_user_id,
    actor_id, command_id
  ) values (
    v_meeting.id, v_meeting.implementation_id, 'scheduled', null, 'scheduled',
    v_meeting.starts_at, v_meeting.ends_at, v_meeting.time_zone, v_meeting.mode,
    v_meeting.responsible_user_id, v_actor, v_command_id
  );

  return public.admin_get_commercial_meeting_state(v_implementation_id);
end;
$$;

create or replace function public.admin_reschedule_commercial_meeting(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_meeting_id uuid;
  v_responsible_id uuid;
  v_command_id uuid;
  v_expected_version integer;
  v_time_zone text := trim(coalesce(p_data->>'timeZone', ''));
  v_mode text := trim(coalesce(p_data->>'mode', ''));
  v_join_url text := nullif(trim(coalesce(p_data->>'joinUrl', '')), '');
  v_starts_local timestamp;
  v_starts_at timestamptz;
  v_old public.implementation_commercial_meetings%rowtype;
  v_new public.implementation_commercial_meetings%rowtype;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para reagendar reunião comercial';
  end if;

  if coalesce(p_data->>'startsAtLocal', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$' then
    raise exception 'data da reunião inválida';
  end if;

  begin
    v_meeting_id := (p_data->>'meetingId')::uuid;
    v_responsible_id := (p_data->>'responsibleUserId')::uuid;
    v_command_id := (p_data->>'commandId')::uuid;
    v_expected_version := (p_data->>'expectedVersion')::integer;
    v_starts_local := (p_data->>'startsAtLocal')::timestamp;
  exception when others then
    raise exception 'dados de reagendamento inválidos';
  end;

  perform pg_advisory_xact_lock(hashtext('commercial_meeting_id:' || v_meeting_id::text));

  select m.* into v_new
  from public.implementation_commercial_meetings m
  where m.command_id = v_command_id;
  if found then
    return public.admin_get_commercial_meeting_state(v_new.implementation_id);
  end if;

  select * into v_old
  from public.implementation_commercial_meetings
  where id = v_meeting_id
  for update;
  if not found then raise exception 'reunião não encontrada'; end if;
  if v_old.version <> v_expected_version then raise exception 'conflito de atualização; recarregue a reunião'; end if;
  if v_old.status not in ('scheduled', 'confirmed') then raise exception 'reunião não pode ser reagendada neste estado'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_time_zone) then raise exception 'fuso horário inválido'; end if;
  if v_mode not in ('video', 'in_person') then raise exception 'formato de reunião inválido'; end if;
  if v_join_url is not null and (v_mode <> 'video' or v_join_url !~* '^https://[^[:space:]]+$') then raise exception 'link de videochamada inválido'; end if;
  if not exists (
    select 1 from public.admin_profiles ap
    where ap.id = v_responsible_id and ap.active is true
      and ap.role in ('super_admin', 'admin', 'commercial', 'operations')
  ) then raise exception 'responsável interno inválido'; end if;

  v_starts_at := v_starts_local at time zone v_time_zone;
  if v_starts_at <= now() then raise exception 'a reunião deve ser reagendada para uma data futura'; end if;

  perform pg_advisory_xact_lock(hashtext('commercial_meeting:' || v_old.implementation_id::text));

  update public.implementation_commercial_meetings
  set status = 'rescheduled', join_url = null, version = version + 1,
      updated_by = v_actor, updated_at = now()
  where id = v_old.id;

  insert into public.implementation_commercial_meetings (
    implementation_id, starts_at, time_zone, mode, join_url, status,
    responsible_user_id, rescheduled_from_id, command_id, created_by, updated_by
  ) values (
    v_old.implementation_id, v_starts_at, v_time_zone, v_mode,
    case when v_mode = 'video' then v_join_url else null end,
    'scheduled', v_responsible_id, v_old.id, v_command_id, v_actor, v_actor
  ) returning * into v_new;

  insert into public.implementation_commercial_meeting_events (
    meeting_id, implementation_id, event_type, from_status, to_status,
    starts_at, ends_at, time_zone, mode, responsible_user_id,
    replacement_meeting_id, actor_id, command_id
  ) values (
    v_old.id, v_old.implementation_id, 'rescheduled', v_old.status, 'rescheduled',
    v_old.starts_at, v_old.ends_at, v_old.time_zone, v_old.mode,
    v_old.responsible_user_id, v_new.id, v_actor, v_command_id
  );

  return public.admin_get_commercial_meeting_state(v_old.implementation_id);
end;
$$;

create or replace function public.admin_update_commercial_meeting_status(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_meeting_id uuid;
  v_command_id uuid;
  v_expected_version integer;
  v_target text := trim(coalesce(p_data->>'status', ''));
  v_from_status text;
  v_meeting public.implementation_commercial_meetings%rowtype;
  v_existing_event public.implementation_commercial_meeting_events%rowtype;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para alterar reunião comercial';
  end if;

  begin
    v_meeting_id := (p_data->>'meetingId')::uuid;
    v_command_id := (p_data->>'commandId')::uuid;
    v_expected_version := (p_data->>'expectedVersion')::integer;
  exception when others then
    raise exception 'comando de reunião inválido';
  end;

  if v_target not in ('confirmed', 'completed', 'cancelled', 'no_show') then
    raise exception 'transição de reunião inválida';
  end if;

  perform pg_advisory_xact_lock(hashtext('commercial_meeting_id:' || v_meeting_id::text));

  select * into v_existing_event
  from public.implementation_commercial_meeting_events
  where command_id = v_command_id;
  if found then
    return public.admin_get_commercial_meeting_state(v_existing_event.implementation_id);
  end if;

  select * into v_meeting
  from public.implementation_commercial_meetings
  where id = v_meeting_id
  for update;
  if not found then raise exception 'reunião não encontrada'; end if;
  if v_meeting.version <> v_expected_version then raise exception 'conflito de atualização; recarregue a reunião'; end if;
  if v_meeting.status = 'scheduled' and v_target not in ('confirmed', 'completed', 'cancelled', 'no_show') then
    raise exception 'transição de reunião inválida';
  end if;
  if v_meeting.status = 'confirmed' and v_target not in ('completed', 'cancelled', 'no_show') then
    raise exception 'transição de reunião inválida';
  end if;
  if v_meeting.status not in ('scheduled', 'confirmed') then
    raise exception 'reunião já está encerrada';
  end if;

  v_from_status := v_meeting.status;

  update public.implementation_commercial_meetings
  set status = v_target,
      join_url = case when v_target = 'confirmed' then join_url else null end,
      version = version + 1,
      updated_by = v_actor,
      updated_at = now()
  where id = v_meeting.id
  returning * into v_meeting;

  insert into public.implementation_commercial_meeting_events (
    meeting_id, implementation_id, event_type, from_status, to_status,
    starts_at, ends_at, time_zone, mode, responsible_user_id,
    actor_id, command_id
  ) values (
    v_meeting.id, v_meeting.implementation_id, v_target, v_from_status, v_target,
    v_meeting.starts_at, v_meeting.ends_at, v_meeting.time_zone, v_meeting.mode,
    v_meeting.responsible_user_id, v_actor, v_command_id
  );

  return public.admin_get_commercial_meeting_state(v_meeting.implementation_id);
end;
$$;

create or replace function public.admin_set_implementation_next_action(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_implementation_id uuid;
  v_responsible_id uuid;
  v_command_id uuid;
  v_time_zone text := trim(coalesce(p_data->>'timeZone', ''));
  v_title text := regexp_replace(trim(coalesce(p_data->>'title', '')), '\s+', ' ', 'g');
  v_due_local timestamp;
  v_due_at timestamptz;
  v_action public.implementation_next_actions%rowtype;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para alterar próxima ação';
  end if;

  if coalesce(p_data->>'dueAtLocal', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$' then
    raise exception 'prazo da próxima ação inválido';
  end if;

  begin
    v_implementation_id := (p_data->>'implementationId')::uuid;
    v_command_id := (p_data->>'commandId')::uuid;
    v_due_local := (p_data->>'dueAtLocal')::timestamp;
    v_responsible_id := nullif(trim(coalesce(p_data->>'responsibleUserId', '')), '')::uuid;
  exception when others then
    raise exception 'dados da próxima ação inválidos';
  end;

  if char_length(v_title) < 3 or char_length(v_title) > 180 then raise exception 'título da próxima ação inválido'; end if;
  if not exists (select 1 from public.implementation_projects where id = v_implementation_id) then raise exception 'oportunidade não encontrada'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_time_zone) then raise exception 'fuso horário inválido'; end if;
  if v_responsible_id is not null and not exists (
    select 1 from public.admin_profiles ap
    where ap.id = v_responsible_id and ap.active is true
      and ap.role in ('super_admin', 'admin', 'commercial', 'operations')
  ) then raise exception 'responsável interno inválido'; end if;

  perform pg_advisory_xact_lock(hashtext('next_action:' || v_implementation_id::text));

  select * into v_action from public.implementation_next_actions where command_id = v_command_id;
  if found then return public.admin_get_commercial_meeting_state(v_implementation_id); end if;

  v_due_at := v_due_local at time zone v_time_zone;

  update public.implementation_next_actions
  set status = 'superseded', version = version + 1, updated_by = v_actor,
      updated_at = now(), closed_at = now()
  where implementation_id = v_implementation_id and status = 'active';

  insert into public.implementation_next_actions (
    implementation_id, title, due_at, time_zone, responsible_user_id,
    status, command_id, created_by, updated_by
  ) values (
    v_implementation_id, v_title, v_due_at, v_time_zone, v_responsible_id,
    'active', v_command_id, v_actor, v_actor
  );

  return public.admin_get_commercial_meeting_state(v_implementation_id);
end;
$$;

create or replace function public.admin_close_implementation_next_action(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_action_id uuid;
  v_command_id uuid;
  v_expected_version integer;
  v_target text := trim(coalesce(p_data->>'status', ''));
  v_action public.implementation_next_actions%rowtype;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para encerrar próxima ação';
  end if;

  begin
    v_action_id := (p_data->>'actionId')::uuid;
    v_command_id := (p_data->>'commandId')::uuid;
    v_expected_version := (p_data->>'expectedVersion')::integer;
  exception when others then
    raise exception 'comando de próxima ação inválido';
  end;

  if v_target not in ('completed', 'cancelled') then raise exception 'status de próxima ação inválido'; end if;

  perform pg_advisory_xact_lock(hashtext('next_action_id:' || v_action_id::text));

  select * into v_action from public.implementation_next_actions where closed_command_id = v_command_id;
  if found then return public.admin_get_commercial_meeting_state(v_action.implementation_id); end if;

  select * into v_action from public.implementation_next_actions where id = v_action_id for update;
  if not found then raise exception 'próxima ação não encontrada'; end if;
  if v_action.version <> v_expected_version then raise exception 'conflito de atualização; recarregue a próxima ação'; end if;
  if v_action.status <> 'active' then raise exception 'próxima ação já está encerrada'; end if;

  update public.implementation_next_actions
  set status = v_target,
      closed_command_id = v_command_id,
      version = version + 1,
      updated_by = v_actor,
      updated_at = now(),
      closed_at = now()
  where id = v_action.id
  returning * into v_action;

  return public.admin_get_commercial_meeting_state(v_action.implementation_id);
end;
$$;

revoke all on function public.admin_list_commercial_assignees() from public, anon;
revoke all on function public.admin_get_commercial_meeting_state(uuid) from public, anon;
revoke all on function public.admin_list_commercial_overview() from public, anon;
revoke all on function public.admin_schedule_commercial_meeting(jsonb) from public, anon;
revoke all on function public.admin_reschedule_commercial_meeting(jsonb) from public, anon;
revoke all on function public.admin_update_commercial_meeting_status(jsonb) from public, anon;
revoke all on function public.admin_set_implementation_next_action(jsonb) from public, anon;
revoke all on function public.admin_close_implementation_next_action(jsonb) from public, anon;

grant execute on function public.admin_list_commercial_assignees() to authenticated;
grant execute on function public.admin_get_commercial_meeting_state(uuid) to authenticated;
grant execute on function public.admin_list_commercial_overview() to authenticated;
grant execute on function public.admin_schedule_commercial_meeting(jsonb) to authenticated;
grant execute on function public.admin_reschedule_commercial_meeting(jsonb) to authenticated;
grant execute on function public.admin_update_commercial_meeting_status(jsonb) to authenticated;
grant execute on function public.admin_set_implementation_next_action(jsonb) to authenticated;
grant execute on function public.admin_close_implementation_next_action(jsonb) to authenticated;
