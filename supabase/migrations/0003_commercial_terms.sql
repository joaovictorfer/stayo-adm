-- Fase 4: condições comerciais configuráveis (defaults + snapshot por
-- implantação). Nenhum valor (taxa de administração, limpeza, implantação
-- etc.) fica hardcoded no código — tudo vem daqui.

create type charge_type as enum (
  'percentage',
  'fixed_once',
  'per_reservation',
  'monthly',
  'optional',
  'informational'
);

create table commercial_term_defaults (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  charge_type charge_type not null,
  value numeric not null default 0,
  optional boolean not null default false,
  display_order integer not null default 0,
  notes text
);

alter table commercial_term_defaults enable row level security;

create policy "time interno lê defaults comerciais"
  on commercial_term_defaults for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/admin gerenciam defaults comerciais"
  on commercial_term_defaults for all
  using (has_admin_role('super_admin', 'admin', 'commercial'))
  with check (has_admin_role('super_admin', 'admin', 'commercial'));

-- Snapshot por implantação — mudar um default no futuro NUNCA altera uma
-- implantação já criada (cada uma tem sua própria cópia).
--
-- `implementation_id` ainda não é FK: `ImplementationProject` continua
-- vivendo em `CoreApiClient`/localStorage por decisão da Fase 1 (ver
-- docs/OWNER_IMPLEMENTATION_ARCHITECTURE.md §6) — a referência formal
-- (`references implementation_projects (id)`) entra quando essa tabela
-- for criada, junto da extração real dessa entidade.
create table commercial_terms (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null,
  label text not null,
  charge_type charge_type not null,
  value numeric not null default 0,
  optional boolean not null default false,
  display_order integer not null default 0,
  notes text
);

create index commercial_terms_implementation_idx on commercial_terms (implementation_id);

alter table commercial_terms enable row level security;

create policy "time interno lê condições comerciais"
  on commercial_terms for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/admin gerenciam condições comerciais"
  on commercial_terms for all
  using (has_admin_role('super_admin', 'admin', 'commercial'))
  with check (has_admin_role('super_admin', 'admin', 'commercial'));
