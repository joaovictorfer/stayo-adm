\set ON_ERROR_STOP on

insert into public.admin_profiles (id, full_name, role, active) values
  ('11111111-1111-1111-1111-111111111111', 'Admin Teste', 'super_admin', true),
  ('22222222-2222-2222-2222-222222222222', 'Viewer Teste', 'viewer', true),
  ('33333333-3333-3333-3333-333333333333', 'Operações Teste', 'operations', true);

insert into public.implementation_projects (
  id, code, provisional_title, owner_name, owner_phone, status, responsible_user_id
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'IMP-TEST-2B',
  'Oportunidade Fase 2B',
  'Contato Teste',
  '51999999999',
  'prospect',
  '11111111-1111-1111-1111-111111111111'
);

-- Operador autorizado cria a reunião. O mesmo commandId deve ser idempotente.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select public.admin_schedule_commercial_meeting(
  jsonb_build_object(
    'implementationId', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'startsAtLocal', '2099-10-02T15:00',
    'timeZone', 'America/Sao_Paulo',
    'mode', 'video',
    'joinUrl', 'https://meet.example.test/stayo-2b',
    'responsibleUserId', '11111111-1111-1111-1111-111111111111',
    'commandId', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  )
);

select public.admin_schedule_commercial_meeting(
  jsonb_build_object(
    'implementationId', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'startsAtLocal', '2099-10-02T15:00',
    'timeZone', 'America/Sao_Paulo',
    'mode', 'video',
    'joinUrl', 'https://meet.example.test/stayo-2b',
    'responsibleUserId', '11111111-1111-1111-1111-111111111111',
    'commandId', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  )
);

reset role;

do $$
declare
  v_count integer;
  v_event_count integer;
begin
  select count(*) into v_count
  from public.implementation_commercial_meetings
  where implementation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  select count(*) into v_event_count
  from public.implementation_commercial_meeting_events
  where implementation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  if v_count <> 1 then
    raise exception 'schedule idempotency failed: expected 1 meeting, got %', v_count;
  end if;
  if v_event_count <> 1 then
    raise exception 'schedule event idempotency failed: expected 1 event, got %', v_event_count;
  end if;
end
$$;

select id as original_meeting_id, starts_at as original_starts_at, responsible_user_id as original_responsible
from public.implementation_commercial_meetings
where implementation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\gset

-- Reagenda: a ocorrência anterior precisa permanecer imutavelmente identificável
-- e a nova ocorrência vira a única reunião ativa.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select public.admin_reschedule_commercial_meeting(
  jsonb_build_object(
    'meetingId', :'original_meeting_id',
    'startsAtLocal', '2099-10-03T16:30',
    'timeZone', 'America/Sao_Paulo',
    'mode', 'in_person',
    'joinUrl', null,
    'responsibleUserId', '33333333-3333-3333-3333-333333333333',
    'expectedVersion', 1,
    'commandId', 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  )
);

select public.admin_reschedule_commercial_meeting(
  jsonb_build_object(
    'meetingId', :'original_meeting_id',
    'startsAtLocal', '2099-10-03T16:30',
    'timeZone', 'America/Sao_Paulo',
    'mode', 'in_person',
    'joinUrl', null,
    'responsibleUserId', '33333333-3333-3333-3333-333333333333',
    'expectedVersion', 1,
    'commandId', 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  )
);

reset role;

do $$
declare
  v_meetings integer;
  v_active integer;
  v_events integer;
  v_old public.implementation_commercial_meetings%rowtype;
  v_new public.implementation_commercial_meetings%rowtype;
begin
  select count(*) into v_meetings
  from public.implementation_commercial_meetings
  where implementation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  select count(*) into v_active
  from public.implementation_commercial_meetings
  where implementation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and status in ('scheduled', 'confirmed');

  select count(*) into v_events
  from public.implementation_commercial_meeting_events
  where implementation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  select * into v_old
  from public.implementation_commercial_meetings
  where id = :'original_meeting_id';

  select * into v_new
  from public.implementation_commercial_meetings
  where rescheduled_from_id = :'original_meeting_id';

  if v_meetings <> 2 then
    raise exception 'reschedule history failed: expected 2 occurrences, got %', v_meetings;
  end if;
  if v_active <> 1 then
    raise exception 'reschedule active uniqueness failed: expected 1 active, got %', v_active;
  end if;
  if v_events <> 2 then
    raise exception 'reschedule event idempotency failed: expected 2 events, got %', v_events;
  end if;
  if v_old.status <> 'rescheduled' then
    raise exception 'old meeting status was not preserved as rescheduled';
  end if;
  if v_old.starts_at <> :'original_starts_at'::timestamptz then
    raise exception 'old meeting start was overwritten';
  end if;
  if v_old.responsible_user_id <> :'original_responsible'::uuid then
    raise exception 'old meeting responsible was overwritten';
  end if;
  if v_old.join_url is not null then
    raise exception 'stale meeting link should be removed from historical occurrence';
  end if;
  if v_new.responsible_user_id <> '33333333-3333-3333-3333-333333333333'::uuid then
    raise exception 'new meeting responsible was not applied';
  end if;
  if v_new.mode <> 'in_person' then
    raise exception 'new meeting mode was not applied';
  end if;
  if not exists (
    select 1
    from public.implementation_commercial_meeting_events e
    where e.meeting_id = v_old.id
      and e.event_type = 'rescheduled'
      and e.from_status = 'scheduled'
      and e.to_status = 'rescheduled'
      and e.replacement_meeting_id = v_new.id
  ) then
    raise exception 'reschedule event did not preserve transition/replacement';
  end if;
end
$$;

-- Próxima ação: criação idempotente e substituição preserva histórico.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.admin_set_implementation_next_action(
  jsonb_build_object(
    'implementationId', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'title', 'Confirmar documentação comercial',
    'dueAtLocal', '2099-10-04T12:00',
    'timeZone', 'America/Sao_Paulo',
    'responsibleUserId', '11111111-1111-1111-1111-111111111111',
    'commandId', 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  )
);
select public.admin_set_implementation_next_action(
  jsonb_build_object(
    'implementationId', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'title', 'Confirmar documentação comercial',
    'dueAtLocal', '2099-10-04T12:00',
    'timeZone', 'America/Sao_Paulo',
    'responsibleUserId', '11111111-1111-1111-1111-111111111111',
    'commandId', 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  )
);
reset role;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.implementation_next_actions
  where implementation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if v_count <> 1 then
    raise exception 'next action idempotency failed: expected 1 row, got %', v_count;
  end if;
end
$$;

-- authenticated sem papel permitido: RLS retorna 0 e RPC deve negar.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select (count(*) = 0) as viewer_reads_zero
from public.implementation_commercial_meetings
\gset
\if :viewer_reads_zero
\else
  \echo 'viewer unexpectedly read commercial meetings'
  \quit 1
\endif

do $$
declare
  v_denied boolean := false;
begin
  begin
    perform public.admin_get_commercial_meeting_state('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  exception when others then
    if sqlerrm like 'sem permissão%' then
      v_denied := true;
    else
      raise;
    end if;
  end;
  if not v_denied then
    raise exception 'viewer RPC should have been denied';
  end if;
end
$$;
reset role;

-- anon: sem grant de tabela e sem EXECUTE das RPCs.
set role anon;
do $$
declare
  v_table_denied boolean := false;
  v_rpc_denied boolean := false;
begin
  begin
    execute 'select 1 from public.implementation_commercial_meetings limit 1';
  exception when insufficient_privilege then
    v_table_denied := true;
  end;

  begin
    perform public.admin_get_commercial_meeting_state('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  exception when insufficient_privilege then
    v_rpc_denied := true;
  end;

  if not v_table_denied then
    raise exception 'anon table read should have been denied';
  end if;
  if not v_rpc_denied then
    raise exception 'anon RPC execute should have been denied';
  end if;
end
$$;
reset role;
