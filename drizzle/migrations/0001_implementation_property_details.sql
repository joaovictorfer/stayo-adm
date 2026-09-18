-- Fase 3: cadastro estruturado do imóvel dentro da implantação.
-- Acessos/Wi-Fi são dados protegidos: os valores ficam aqui, mas nunca
-- entram em audit log, PDF público ou portal aberto.

create table public.implementation_property_details (
  implementation_id uuid primary key references public.implementation_projects (id) on delete cascade,
  postal_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  property_type text,
  bedrooms integer,
  suites integer,
  bathrooms integer,
  parking_spots integer,
  access_notes text,
  wifi_network text,
  wifi_password text,
  notes text,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.implementation_property_details to authenticated;
grant all on public.implementation_property_details to service_role;

alter table public.implementation_property_details enable row level security;

create policy "time interno lê dados do imóvel da implantação"
  on public.implementation_property_details for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam dados do imóvel"
  on public.implementation_property_details for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create table public.implementation_rooms (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references public.implementation_projects (id) on delete cascade,
  name text not null,
  kind text not null default 'quarto',
  beds text,
  capacity integer,
  display_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index implementation_rooms_implementation_idx
  on public.implementation_rooms (implementation_id);

grant select, insert, update, delete on public.implementation_rooms to authenticated;
grant all on public.implementation_rooms to service_role;

alter table public.implementation_rooms enable row level security;

create policy "time interno lê ambientes da implantação"
  on public.implementation_rooms for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam ambientes"
  on public.implementation_rooms for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'));
