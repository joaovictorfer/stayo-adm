-- Fase 17E: extrai ImplementationProject/ImplementationItem do mock do
-- Core para tabelas reais do Admin (Grupo A) — resolve a decisão de
-- adiamento registrada em docs/OWNER_IMPLEMENTATION_ARCHITECTURE.md §6,
-- agora que o plano de produção pede persistência real para este domínio.
--
-- NOTA IMPORTANTE: esta migration só cria o schema e a RLS — o adapter
-- (`src/lib/api/core-client.ts`/`admin-client.ts`) e a UI continuam lendo
-- do mock local por enquanto. Trocar a leitura de verdade é uma
-- refatoração de superfície grande (toda tela de Implantação, Portal,
-- Proposta, Dashboard e BI referencia `implementationId`) que precisa do
-- mesmo rigor de validação fase-a-fase do resto do plano, não de uma
-- troca apressada dentro desta mesma migration. Ver
-- docs/DATA_PERSISTENCE.md para o estado exato disso.
--
-- Diferença deliberada do tipo TS local: `ownerName`/`ownerPhone` são
-- campos denormalizados no mock (sem join disponível em localStorage).
-- Numa tabela relacional de verdade, isso é só `owner_id` — o nome/telefone
-- vêm de um join com `owner_records` quando o adapter for escrito.

create type implementation_status as enum (
  'prospect',
  'proposta',
  'aguardando_aprovacao',
  'aprovado',
  'planejamento',
  'em_implantacao',
  'validacao',
  'pronto_para_operacao',
  'ativo',
  'pausado',
  'nao_convertido',
  'cancelado'
);

create type implementation_item_status as enum (
  'pendente', 'em_andamento', 'concluido', 'bloqueado', 'nao_aplicavel', 'pulado'
);

create table implementation_projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status implementation_status not null default 'prospect',
  owner_id uuid references owner_records (id),
  nickname text,
  condominium_name text,
  unit text,
  address text,
  postal_code text,
  city text,
  property_type text,
  bedrooms integer,
  capacity integer,
  responsible_user_id uuid,
  start_date_estimate date,
  completion_date_estimate date,
  notes text,
  origin text,
  -- Preenchidos só após a conversão para o Core (Fase 11) — nunca fabricados antes disso.
  core_property_id uuid,
  core_owner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index implementation_projects_owner_idx on implementation_projects (owner_id);
create index implementation_projects_status_idx on implementation_projects (status);

create trigger implementation_projects_set_updated_at
  before update on implementation_projects
  for each row
  execute function set_updated_at();

alter table implementation_projects enable row level security;

create policy "time interno lê implantações"
  on implementation_projects for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam implantações"
  on implementation_projects for all
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create table implementation_items (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references implementation_projects (id) on delete cascade,
  category text not null,
  phase text not null,
  title text not null,
  description text,
  display_order integer not null default 0,
  responsible_user_id uuid,
  due_date date,
  status implementation_item_status not null default 'pendente',
  observation text,
  mandatory boolean not null default false,
  blocker boolean not null default false,
  owner_visible boolean not null default false,
  completed_at timestamptz,
  completed_by uuid,
  -- Override formal de prontidão (Fase 5) — nunca resolvido implicitamente.
  readiness_override_reason text,
  readiness_override_by text,
  readiness_override_at timestamptz
);

create index implementation_items_implementation_idx on implementation_items (implementation_id);

alter table implementation_items enable row level security;

create policy "time interno lê checklist"
  on implementation_items for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam checklist"
  on implementation_items for all
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (has_admin_role('super_admin', 'admin', 'commercial', 'operations'));
