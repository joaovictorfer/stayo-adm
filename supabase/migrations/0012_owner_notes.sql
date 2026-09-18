-- Fase 17F: schema real para notas internas por proprietário
-- (`stayo-admin:owner-notes`, `ownerNotesStore` em local-store.ts) —
-- anotação livre da Central do Proprietário, uma por `owner_id` (o mock
-- local também é 1:1 por proprietário, nunca um histórico de notas).
--
-- RLS igual à de `owner_records` (migration 0002): é dado interno sobre
-- o relacionamento comercial, nunca visível ao proprietário mesmo — não
-- existe policy nenhuma que o portal público possa usar aqui.
--
-- Adapter/UI continuam lendo do mock local por enquanto, mesmo motivo de
-- adiamento das migrations anteriores — ver docs/DATA_PERSISTENCE.md.

create table owner_notes (
  owner_id uuid primary key references owner_records (id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

create trigger owner_notes_set_updated_at
  before update on owner_notes
  for each row
  execute function set_updated_at();

alter table owner_notes enable row level security;

create policy "time interno lê notas de proprietário"
  on owner_notes for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial gerencia notas de proprietário"
  on owner_notes for all
  using (has_admin_role('super_admin', 'admin', 'commercial'))
  with check (has_admin_role('super_admin', 'admin', 'commercial'));
