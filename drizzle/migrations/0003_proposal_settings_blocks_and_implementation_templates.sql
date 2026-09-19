-- Fase 5: condições/prazo da proposta, blocos de regras com visibilidade por
-- destino e modelos de implantação (snapshot, nunca vínculo).

create type public.proposal_block_visibility as enum ('interno', 'proposta', 'portal');

create table public.implementation_proposal_settings (
  implementation_id uuid primary key references public.implementation_projects (id) on delete cascade,
  validity_days integer not null default 30,
  payment_notes text,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.implementation_proposal_settings to authenticated;
grant all on public.implementation_proposal_settings to service_role;

alter table public.implementation_proposal_settings enable row level security;

create policy "time interno lê condições da proposta"
  on public.implementation_proposal_settings for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial gerencia condições da proposta"
  on public.implementation_proposal_settings for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial'));

create table public.proposal_content_blocks (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references public.implementation_projects (id) on delete cascade,
  title text not null,
  body text not null default '',
  visibility public.proposal_block_visibility not null default 'proposta',
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index proposal_content_blocks_implementation_idx
  on public.proposal_content_blocks (implementation_id, display_order);

grant select, insert, update, delete on public.proposal_content_blocks to authenticated;
grant all on public.proposal_content_blocks to service_role;

alter table public.proposal_content_blocks enable row level security;

create policy "time interno lê blocos da proposta"
  on public.proposal_content_blocks for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial gerencia blocos da proposta"
  on public.proposal_content_blocks for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial'));

-- Modelos de implantação: o payload é um snapshot de configuração
-- (condições, blocos, enxoval). NUNCA contém dado pessoal de proprietário.
create table public.implementation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.implementation_templates to authenticated;
grant all on public.implementation_templates to service_role;

alter table public.implementation_templates enable row level security;

create policy "time interno lê modelos de implantação"
  on public.implementation_templates for select
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam modelos de implantação"
  on public.implementation_templates for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial', 'operations'));
