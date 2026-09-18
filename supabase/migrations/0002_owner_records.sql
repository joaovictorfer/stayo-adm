-- Fase 2: proprietário como entidade real do Admin (owner_records).
--
-- Existe antes de haver imóvel oficial no Stayo Core. `core_owner_id` só é
-- preenchido após a conversão (Fase 11) — nunca confundir com o Owner
-- oficial do Core (fora deste schema, só leitura via CoreApiClient).

create table owner_records (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  document text,
  lifecycle_status text not null default 'prospect'
    check (lifecycle_status in ('prospect', 'ativo', 'inativo')),
  core_owner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index owner_records_phone_idx on owner_records (phone);

create trigger owner_records_set_updated_at
  before update on owner_records
  for each row
  execute function set_updated_at();

alter table owner_records enable row level security;

-- Leitura: todo o time interno (inclusive finance/operations/viewer) precisa
-- ver quem é o proprietário ao consultar implantação, contrato, cobrança.
create policy "time interno lê proprietários"
  on owner_records for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

-- Escrita: só quem conduz a relação comercial.
create policy "comercial/admin criam proprietários"
  on owner_records for insert
  with check (has_admin_role('super_admin', 'admin', 'commercial'));

create policy "comercial/admin atualizam proprietários"
  on owner_records for update
  using (has_admin_role('super_admin', 'admin', 'commercial'))
  with check (has_admin_role('super_admin', 'admin', 'commercial'));
