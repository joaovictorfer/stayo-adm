-- Fase 17I: Owner Tasks ("Precisamos de você") — pendências do
-- proprietário (dado bancário faltando, Wi-Fi faltando, documento de
-- regularização faltando etc.), visíveis de forma consistente para o
-- admin (que cria/gerencia) e para o próprio proprietário (que só lê,
-- via a mesma RLS de leitura própria criada na Fase 17H, migration 0013
-- — reusa `owner_portal_accounts`, nenhuma tabela nova de vínculo).
--
-- Deliberadamente sem escrita do proprietário aqui: marcar uma pendência
-- como resolvida é sempre o time interno confirmando que o dado chegou
-- de verdade (por WhatsApp, por e-mail, por uma ligação) — nunca um
-- `update` direto do proprietário sob a própria sessão. Mesmo princípio
-- de "escrita do proprietário sempre por RPC revalidada" usado no
-- auto-cadastro e no aceite de proposta, aplicado aqui como "escrita do
-- proprietário nem existe, só leitura".

create type owner_task_status as enum ('pending', 'done', 'dismissed');

create table owner_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owner_records (id) on delete cascade,
  implementation_id uuid references implementation_projects (id) on delete cascade,
  kind text not null,
  title text not null,
  description text,
  status owner_task_status not null default 'pending',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  completed_at timestamptz
);

create index owner_tasks_owner_idx on owner_tasks (owner_id);
create index owner_tasks_implementation_idx on owner_tasks (implementation_id);

alter table owner_tasks enable row level security;

create policy "time interno lê pendências do proprietário"
  on owner_tasks for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam pendências do proprietário"
  on owner_tasks for all
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create policy "proprietário lê as próprias pendências"
  on owner_tasks for select
  using (exists (
    select 1 from owner_portal_accounts opa
    where opa.id = auth.uid() and opa.owner_id = owner_tasks.owner_id
  ));
