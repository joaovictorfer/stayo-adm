-- Fase 8: convite seguro do portal do proprietário (seção 16 do plano).
--
-- `implementation_id` ainda não é FK pelo mesmo motivo de
-- commercial_terms (ver migration 0003) — ImplementationProject continua
-- em CoreApiClient/localStorage por ora.
--
-- O token NUNCA é guardado em texto puro, só o hash (SHA-256, calculado
-- no cliente antes de qualquer escrita — ver src/lib/api/token-hash.ts).

create table owner_portal_invitations (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  last_access_at timestamptz
);

create index owner_portal_invitations_implementation_idx
  on owner_portal_invitations (implementation_id);

alter table owner_portal_invitations enable row level security;

-- Leitura/gestão: time interno. O proprietário nunca lê esta tabela
-- diretamente — ele só apresenta o token, que o backend resolve.
create policy "time interno lê convites"
  on owner_portal_invitations for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create policy "comercial/admin criam e revogam convites"
  on owner_portal_invitations for all
  using (has_admin_role('super_admin', 'admin', 'commercial'))
  with check (has_admin_role('super_admin', 'admin', 'commercial'));
