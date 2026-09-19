-- Fase 4: enxoval e itens faltantes da implantação.
-- Nada de lista fixa no código: todo item é cadastrado pela interface e
-- pode virar template reaplicável.

create type public.supply_module as enum ('enxoval', 'faltante');
create type public.supply_status as enum ('pendente', 'comprado', 'entregue', 'instalado', 'nao_aplicavel');
create type public.supply_priority as enum ('baixa', 'media', 'alta');

create table public.implementation_supply_items (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references public.implementation_projects (id) on delete cascade,
  module public.supply_module not null,
  name text not null,
  room text,
  size text,
  required_qty integer not null default 0,
  existing_qty integer not null default 0,
  status public.supply_status not null default 'pendente',
  priority public.supply_priority not null default 'media',
  responsible text,
  blocks_readiness boolean not null default false,
  notes text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index implementation_supply_items_implementation_idx
  on public.implementation_supply_items (implementation_id, module);

grant select, insert, update, delete on public.implementation_supply_items to authenticated;
grant all on public.implementation_supply_items to service_role;

alter table public.implementation_supply_items enable row level security;

create policy "time interno lê enxoval e faltantes"
  on public.implementation_supply_items for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam enxoval e faltantes"
  on public.implementation_supply_items for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create trigger implementation_supply_items_set_updated_at
  before update on public.implementation_supply_items
  for each row execute function public.set_updated_at();

create table public.supply_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  module public.supply_module not null default 'enxoval',
  notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.supply_templates to authenticated;
grant all on public.supply_templates to service_role;

alter table public.supply_templates enable row level security;

create policy "time interno lê templates de enxoval"
  on public.supply_templates for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam templates de enxoval"
  on public.supply_templates for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create table public.supply_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.supply_templates (id) on delete cascade,
  name text not null,
  room text,
  size text,
  required_qty integer not null default 0,
  display_order integer not null default 0
);

create index supply_template_items_template_idx
  on public.supply_template_items (template_id);

grant select, insert, update, delete on public.supply_template_items to authenticated;
grant all on public.supply_template_items to service_role;

alter table public.supply_template_items enable row level security;

create policy "time interno lê itens de template de enxoval"
  on public.supply_template_items for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam itens de template de enxoval"
  on public.supply_template_items for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'));
