-- Fase 2: vários proprietários/proponentes por implantação (relação N:N,
-- nunca owner2_name/owner3_name) e estado de confirmação campo a campo.

create table public.implementation_owners (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references public.implementation_projects (id) on delete cascade,
  owner_id uuid not null references public.owner_records (id) on delete cascade,
  role text not null default 'proprietario',
  share_percent numeric,
  address text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (implementation_id, owner_id)
);

create index implementation_owners_implementation_idx
  on public.implementation_owners (implementation_id);

grant select, insert, update, delete on public.implementation_owners to authenticated;
grant all on public.implementation_owners to service_role;

alter table public.implementation_owners enable row level security;

create policy "time interno lê proprietários da implantação"
  on public.implementation_owners for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam proprietários da implantação"
  on public.implementation_owners for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create policy "proprietário lê o próprio vínculo"
  on public.implementation_owners for select
  using (exists (
    select 1 from public.owner_portal_accounts opa
    where opa.id = auth.uid() and opa.owner_id = implementation_owners.owner_id
  ));

create type public.owner_field_state as enum (
  'not_informed',
  'prefilled_by_stayo',
  'confirmed_by_owner',
  'changed_by_owner',
  'reviewed_by_stayo'
);

create table public.implementation_field_confirmations (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references public.implementation_projects (id) on delete cascade,
  field_key text not null,
  state public.owner_field_state not null default 'not_informed',
  -- valor não sensível apenas: nunca senha de Wi-Fi/fechadura, documento ou selfie
  value_snapshot text,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  unique (implementation_id, field_key)
);

create index implementation_field_confirmations_implementation_idx
  on public.implementation_field_confirmations (implementation_id);

grant select, insert, update, delete on public.implementation_field_confirmations to authenticated;
grant all on public.implementation_field_confirmations to service_role;

alter table public.implementation_field_confirmations enable row level security;

create policy "time interno lê confirmações de campo"
  on public.implementation_field_confirmations for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam confirmações de campo"
  on public.implementation_field_confirmations for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'));
