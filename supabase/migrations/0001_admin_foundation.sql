-- Fundação de banco + auth do Stayo Admin (Fase 1 do plano de evolução da
-- Central Comercial/Onboarding do Proprietário).
--
-- Esta migration só cria o que a Fase 1 precisa: papéis/perfis do time
-- interno e o log de auditoria. As tabelas de domínio (proprietário,
-- pré-imóvel, implantação, condições comerciais, timeline, propostas,
-- portal, cobrança, mensagens) nascem nas migrations das fases seguintes
-- (0002+), cada uma quando a fase correspondente for implementada — não
-- adiantamos schema de fases que ainda não têm código consumidor.
--
-- Pré-requisito: um projeto Supabase real (auth.users já existe nele).
-- Enquanto não houver credencial configurada (VITE_SUPABASE_URL /
-- VITE_SUPABASE_ANON_KEY), o Admin roda sobre o adapter local
-- (src/lib/api/admin-client.ts) e esta migration fica apenas pronta,
-- sem ser aplicada.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Papéis do time interno
-- ---------------------------------------------------------------------

create type admin_role as enum (
  'super_admin',
  'admin',
  'commercial',
  'operations',
  'finance',
  'viewer'
);

create table admin_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role admin_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger admin_profiles_set_updated_at
  before update on admin_profiles
  for each row
  execute function set_updated_at();

-- Helper: papel do usuário autenticado atual (null se não for do time interno).
create or replace function current_admin_role()
returns admin_role
language sql
stable
security definer
set search_path = public
as $$
  select role from admin_profiles where id = auth.uid() and active;
$$;

-- Helper: o usuário autenticado tem um dos papéis informados?
create or replace function has_admin_role(variadic roles admin_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_admin_role() = any(roles);
$$;

alter table admin_profiles enable row level security;

create policy "admin lê o próprio perfil"
  on admin_profiles for select
  using (id = auth.uid());

create policy "super_admin lê todos os perfis"
  on admin_profiles for select
  using (has_admin_role('super_admin'));

create policy "super_admin gerencia perfis"
  on admin_profiles for all
  using (has_admin_role('super_admin'))
  with check (has_admin_role('super_admin'));

-- ---------------------------------------------------------------------
-- Auditoria (seção 30 do plano) — nunca registra segredo/senha/token/PII
-- de documento completo, só metadata de evento.
-- ---------------------------------------------------------------------

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  event text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index audit_logs_event_idx on audit_logs (event);
create index audit_logs_created_at_idx on audit_logs (created_at desc);

alter table audit_logs enable row level security;

-- Qualquer papel do time interno pode registrar eventos (o ator é sempre
-- o próprio usuário autenticado — nunca confiar em actor_id vindo do
-- cliente para OUTRO usuário).
create policy "time interno registra auditoria"
  on audit_logs for insert
  with check (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance')
    and actor_id = auth.uid());

-- Leitura de auditoria é restrita — viewer e papéis operacionais não veem
-- histórico de ações de outros; só quem administra o sistema.
create policy "admin/super_admin leem auditoria"
  on audit_logs for select
  using (has_admin_role('super_admin', 'admin'));
