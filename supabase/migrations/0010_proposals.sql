-- Fase 17G: schema real para Proposta versionada (Fase 6) e seu link
-- público por versão (Fase 6/25) — mesma lacuna documentada em
-- docs/LOCALSTORAGE_MIGRATION.md, mesmo padrão de adiamento de adapter
-- usado na migration 0009 (implementation_projects/items): só schema +
-- RLS aqui, o adapter/UI continuam lendo do mock local por enquanto.
--
-- Decisão deliberada sobre `items`: `ProposalItem` (src/types/core.ts) não
-- tem identidade própria (sem `id`, só descrição/quantidade/valor) — é
-- sempre tratado como uma lista imutável dentro de UMA versão. Uma tabela
-- `proposal_items` separada aumentaria a superfície sem ganhar nada, e
-- ainda arriscaria a garantia central da Fase 6 ("v2 nunca altera v1,
-- snapshot nunca reconsulta dado vivo"): um `jsonb` gravado uma única vez
-- na criação da versão é uma garantia mais forte de imutabilidade do que
-- linhas relacionais que alguém poderia (por engano) fazer `update` nelas
-- depois. `items` é gravado no `insert` e nunca mais atualizado.
--
-- Diferença deliberada do mock local (`src/types/proposal-share.ts`):
-- o mock guarda o `token` em TEXTO PURO. Aqui o token é hasheado
-- (mesmo padrão SHA-256 hex de `owner_portal_invitations`/
-- `src/lib/api/token-hash.ts`) — mudança de segurança intencional, não
-- um bug de schema; documentada também em docs/DATA_PERSISTENCE.md.

create table proposals (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references implementation_projects (id) on delete cascade,
  version integer not null,
  items jsonb not null,
  total numeric(12, 2) not null,
  accepted_at timestamptz,
  accepted_name text,
  created_at timestamptz not null default now(),
  unique (implementation_id, version)
);

create index proposals_implementation_idx on proposals (implementation_id);

alter table proposals enable row level security;

create policy "time interno lê propostas"
  on proposals for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial gerencia propostas"
  on proposals for all
  using (has_admin_role('super_admin', 'admin', 'commercial'))
  with check (has_admin_role('super_admin', 'admin', 'commercial'));

create table proposal_share_links (
  proposal_id uuid primary key references proposals (id) on delete cascade,
  implementation_id uuid not null references implementation_projects (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create index proposal_share_links_implementation_idx on proposal_share_links (implementation_id);

alter table proposal_share_links enable row level security;

create policy "time interno lê links de proposta"
  on proposal_share_links for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer'));

create policy "comercial gerencia links de proposta"
  on proposal_share_links for all
  using (has_admin_role('super_admin', 'admin', 'commercial'))
  with check (has_admin_role('super_admin', 'admin', 'commercial'));

-- ---------------------------------------------------------------------
-- Caminho público (portal.proposta, sem autenticação) — mesma técnica de
-- `owner_onboarding_resolve_token`/`owner_onboarding_submit` (migration
-- 0007): `security definer`, nunca expõe `token_hash`, revalida tudo
-- server-side.
-- ---------------------------------------------------------------------

-- Resolve o token em texto puro (da URL) para os dados públicos da
-- proposta — a versão exata vinculada a este link, nunca "a mais
-- recente da implantação". Isto é o que garante que um link antigo
-- (v1) nunca passa a mostrar uma v2 criada depois.
create or replace function proposal_resolve_by_token(p_token text)
returns table (
  proposal_id uuid,
  implementation_id uuid,
  version integer,
  items jsonb,
  total numeric,
  accepted_at timestamptz,
  accepted_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p.id, p.implementation_id, p.version, p.items, p.total, p.accepted_at, p.accepted_name, p.created_at
  from proposal_share_links l
  join proposals p on p.id = l.proposal_id
  where l.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  limit 1;
$$;

grant execute on function proposal_resolve_by_token(text) to anon, authenticated;

-- Aceita a proposta vinculada ao token. Idempotente por desenho: se a
-- versão já estava aceita (ex: o proprietário confirmou duas vezes, ou
-- duas abas simultâneas), NÃO sobrescreve `accepted_at`/`accepted_name`
-- de novo — devolve o registro já aceito sem tocar nele, exatamente
-- porque uma proposta aceita é imutável (mesma garantia da versão em si).
create or replace function proposal_accept_by_token(p_token text, p_accepted_name text)
returns table (
  proposal_id uuid,
  implementation_id uuid,
  version integer,
  items jsonb,
  total numeric,
  accepted_at timestamptz,
  accepted_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link proposal_share_links%rowtype;
  v_proposal proposals%rowtype;
begin
  select * into v_link
  from proposal_share_links
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'proposta não encontrada';
  end if;

  -- `pr.` é obrigatório aqui: `RETURNS TABLE (...)` declara `accepted_at`/
  -- `accepted_name` como variáveis implícitas no corpo da função, que
  -- colidem (ambiguidade, erro 42702) com as colunas de mesmo nome em
  -- `proposals` se referenciadas sem qualificador.
  update proposals as pr
  set accepted_at = now(), accepted_name = p_accepted_name
  where pr.id = v_link.proposal_id and pr.accepted_at is null
  returning pr.* into v_proposal;

  if not found then
    -- já aceita antes (ou por esta chamada duplicada, ou por outra aba) —
    -- devolve o estado atual em vez de falhar ou reescrever.
    select pr.* into v_proposal from proposals as pr where pr.id = v_link.proposal_id;
  end if;

  return query
    select v_proposal.id, v_proposal.implementation_id, v_proposal.version, v_proposal.items,
           v_proposal.total, v_proposal.accepted_at, v_proposal.accepted_name, v_proposal.created_at;
end;
$$;

grant execute on function proposal_accept_by_token(text, text) to anon, authenticated;
