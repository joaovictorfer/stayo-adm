\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'sandbox_exec') then create role sandbox_exec nologin bypassrls; end if;
end
$$;

create type public.admin_role as enum (
  'super_admin',
  'admin',
  'commercial',
  'operations',
  'finance',
  'viewer'
);

create table public.admin_profiles (
  id uuid primary key,
  full_name text not null,
  role public.admin_role not null,
  active boolean not null default true
);

create table public.implementation_projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  provisional_title text,
  owner_name text,
  owner_phone text,
  status text not null default 'prospect',
  responsible_user_id uuid references public.admin_profiles(id)
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function public.has_admin_role(variadic p_roles public.admin_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.id = auth.uid()
      and ap.active is true
      and ap.role = any(p_roles)
  )
$$;

grant usage on schema public to anon, authenticated, service_role, sandbox_exec;
grant execute on function public.has_admin_role(variadic public.admin_role[]) to authenticated;
