-- Fase 6: conteúdo institucional do portal do proprietário.
-- Cada bloco guarda rascunho e versão publicada; o portal público lê
-- somente a versão publicada. Nenhum dado pessoal aqui.

create type public.portal_block_kind as enum ('hero', 'destaque', 'passo', 'faq', 'rodape');

create table public.portal_content_blocks (
  id uuid primary key default gen_random_uuid(),
  kind public.portal_block_kind not null default 'destaque',
  draft_title text not null default '',
  draft_body text not null default '',
  published_title text,
  published_body text,
  published_at timestamptz,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_content_blocks_order_idx on public.portal_content_blocks (display_order);

grant select, insert, update, delete on public.portal_content_blocks to authenticated;
grant all on public.portal_content_blocks to service_role;
-- landing page pública: leitura anônima liberada (conteúdo institucional)
grant select on public.portal_content_blocks to anon;

alter table public.portal_content_blocks enable row level security;

create policy "qualquer visitante lê blocos do portal"
  on public.portal_content_blocks for select
  using (true);

create policy "admin gerencia blocos do portal"
  on public.portal_content_blocks for all
  using (public.has_admin_role('super_admin', 'admin', 'commercial'))
  with check (public.has_admin_role('super_admin', 'admin', 'commercial'));

create trigger portal_content_blocks_set_updated_at
  before update on public.portal_content_blocks
  for each row execute function public.set_updated_at();
