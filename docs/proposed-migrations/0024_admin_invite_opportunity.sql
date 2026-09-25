-- PROPOSTA (NÃO APLICADA). Aplicar via fluxo oficial de migrations após revisão.
-- 1/7 — Entrada da oportunidade: caminho "Convidar proprietário para cadastro".
-- Cria implementation_projects (prospect) SEM proprietário, telefone, condomínio,
-- unidade, documento ou Property. Não altera linhas nem RPCs existentes.
-- Obrigatórios: permissão (super_admin/admin/commercial) + requestId. Título/responsável opcionais.
-- Sem título grava "Convite · IMP-xxxxx". Idempotência: origin = 'admin_invite:<requestId>'.

create or replace function public.admin_create_invite_opportunity(p_data jsonb)
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
  v_responsible_user_id uuid;
  v_origin text;
begin
  if public.has_admin_role('super_admin', 'admin', 'commercial') is not true then
    raise exception 'sem permissão para criar oportunidade';
  end if;
  if char_length(v_title) > 140 then
    raise exception 'título provisório inválido';
  end if;
  begin
    v_request_id := nullif(trim(p_data->>'requestId'), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'requestId inválido';
  end;
  if v_request_id is null then raise exception 'requestId obrigatório'; end if;
  begin
    v_responsible_user_id := nullif(trim(p_data->>'responsibleUserId'), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'responsável inválido';
  end;
  if v_responsible_user_id is not null and not exists (
    select 1 from public.admin_profiles a where a.id = v_responsible_user_id and a.active
  ) then
    raise exception 'responsável não encontrado';
  end if;

  v_origin := 'admin_invite:' || v_request_id::text;
  perform pg_advisory_xact_lock(hashtext(v_origin));
  select p.* into v_project from public.implementation_projects p where p.origin = v_origin limit 1;
  if found then return v_project; end if;

  perform pg_advisory_xact_lock(hashtext('implementation_code_sequence'));
  select coalesce(max((regexp_match(code, '^IMP-([0-9]+)$'))[1]::integer), 0) + 1
    into v_sequence from public.implementation_projects;
  v_code := 'IMP-' || lpad(v_sequence::text, 5, '0');
  if char_length(v_title) < 1 then v_title := 'Convite · ' || v_code; end if;

  insert into public.implementation_projects (code, status, owner_id, nickname, responsible_user_id, origin)
  values (v_code, 'prospect', null, v_title, v_responsible_user_id, v_origin)
  returning * into v_project;
  return v_project;
end;
$$;

revoke execute on function public.admin_create_invite_opportunity(jsonb) from public;
revoke execute on function public.admin_create_invite_opportunity(jsonb) from anon;
grant execute on function public.admin_create_invite_opportunity(jsonb) to authenticated;
