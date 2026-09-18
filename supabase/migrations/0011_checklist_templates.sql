-- Fase 17F: schema real para templates de checklist de implantação
-- (`stayo-admin:checklist-templates`, `ChecklistTemplateItem` em
-- src/types/checklist-template.ts) — configuração editável pela equipe
-- (categorias/fases mudam com o tempo), nunca hardcoded no código.
--
-- Sem dado sensível/pessoal aqui (é template, não checklist de uma
-- implantação específica — isso é `implementation_items`, migration
-- 0009) — RLS segue o mesmo padrão de `commercial_term_defaults`
-- (migration 0003): leitura ampla para o time interno, gestão restrita a
-- quem decide processo.
--
-- Adapter/UI continuam lendo do mock local por enquanto — mesmo motivo
-- de adiamento das migrations 0009/0010, ver docs/DATA_PERSISTENCE.md.

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  phase text not null,
  title text not null,
  description text,
  mandatory boolean not null default false,
  blocker boolean not null default false,
  owner_visible boolean not null default false,
  display_order integer not null default 0
);

alter table checklist_templates enable row level security;

create policy "time interno lê templates de checklist"
  on checklist_templates for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam templates de checklist"
  on checklist_templates for all
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (has_admin_role('super_admin', 'admin', 'commercial', 'operations'));
