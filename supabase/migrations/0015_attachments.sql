-- Fase 17I: anexos/documentos do proprietário (comprovante bancário,
-- documento de regularização, foto de instalação etc.) — Storage privado
-- de verdade, nunca um bucket público servindo dado sensível.
--
-- `storage.buckets`/`storage.objects` são tabelas Postgres normais por
-- baixo do serviço de Storage do Supabase — criar o bucket via `insert`
-- direto aqui é exatamente o que a API de Storage faria, e a RLS de
-- `storage.objects` é obedecida pelo próprio serviço de Storage em cada
-- upload/download, não só num `select` cru.
--
-- Convenção de caminho: `<owner_id>/<uuid do arquivo>-<nome original>` —
-- é o que permite a RLS restringir cada proprietário à própria pasta sem
-- precisar de uma tabela de permissão separada por objeto.

insert into storage.buckets (id, name, public)
values ('owner-attachments', 'owner-attachments', false);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owner_records (id) on delete cascade,
  implementation_id uuid references implementation_projects (id) on delete cascade,
  owner_task_id uuid references owner_tasks (id) on delete set null,
  storage_path text not null unique,
  category text not null,
  mime_type text not null,
  size_bytes bigint not null,
  filename text not null,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index attachments_owner_idx on attachments (owner_id);
create index attachments_implementation_idx on attachments (implementation_id);

alter table attachments enable row level security;

create policy "time interno lê anexos"
  on attachments for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial/operations gerenciam anexos"
  on attachments for all
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations'))
  with check (has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create policy "proprietário lê os próprios anexos"
  on attachments for select
  using (exists (
    select 1 from owner_portal_accounts opa
    where opa.id = auth.uid() and opa.owner_id = attachments.owner_id
  ));

-- ---------------------------------------------------------------------
-- RLS de `storage.objects` para o bucket `owner-attachments` — o que o
-- serviço de Storage de verdade consulta em cada request, não só quem
-- chamar `select` na tabela crua.
-- ---------------------------------------------------------------------

create policy "time interno acessa todos os anexos no storage"
  on storage.objects for all
  using (
    bucket_id = 'owner-attachments'
    and has_admin_role('super_admin', 'admin', 'commercial', 'operations')
  )
  with check (
    bucket_id = 'owner-attachments'
    and has_admin_role('super_admin', 'admin', 'commercial', 'operations')
  );

create policy "proprietário lê e envia só a própria pasta no storage"
  on storage.objects for select
  using (
    bucket_id = 'owner-attachments'
    and exists (
      select 1 from owner_portal_accounts opa
      where opa.id = auth.uid()
        and opa.owner_id::text = (storage.foldername(name))[1]
    )
  );

create policy "proprietário envia só para a própria pasta no storage"
  on storage.objects for insert
  with check (
    bucket_id = 'owner-attachments'
    and exists (
      select 1 from owner_portal_accounts opa
      where opa.id = auth.uid()
        and opa.owner_id::text = (storage.foldername(name))[1]
    )
  );
