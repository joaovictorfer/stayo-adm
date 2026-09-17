-- Fase 10: cobrança inicial (seção 25 do plano).
--
-- Nasce dos itens `fixed_once` das condições comerciais no momento em que
-- a proposta é aceita — nunca é nota fiscal (seção 26), só o valor devido.
-- Idempotente por proposal_id: aceitar a mesma versão duas vezes nunca
-- duplica cobrança.

create type initial_charge_status as enum (
  'draft', 'issued', 'pending', 'paid', 'cancelled', 'overdue'
);

create table initial_charges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  implementation_id uuid not null,
  owner_id uuid,
  proposal_id uuid not null unique,
  items jsonb not null default '[]'::jsonb,
  amount numeric not null default 0,
  status initial_charge_status not null default 'pending',
  due_at timestamptz,
  payment_reference text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index initial_charges_implementation_idx on initial_charges (implementation_id);

alter table initial_charges enable row level security;

create policy "time interno lê cobranças"
  on initial_charges for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'finance'));

create policy "financeiro/admin gerenciam cobranças"
  on initial_charges for all
  using (has_admin_role('super_admin', 'admin', 'finance'))
  with check (has_admin_role('super_admin', 'admin', 'finance'));
