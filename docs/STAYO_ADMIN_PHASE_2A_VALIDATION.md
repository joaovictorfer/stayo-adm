# STAYO ADMIN — Fase 2A / gate de segurança do portal público

Data: 24/09/2026

## Escopo

Fechar o P0 de exposição da tabela interna `public.portal_content_blocks` sem criar nova superfície pública e sem alterar o desenho das telas.

## Estado canônico de entrada

- repositório: `joaovictorfer/stayo-adm`;
- `main` inicial: `f3d07b0e816afcd9b8529c240708c0e5750a9a17`;
- branch: `phase2a-portal-content-security`;
- Lovable: `Stayo Adm`;
- Project ID: `696b2125-0bf9-4538-8458-05d88fc5e8a2`;
- GitHub e Lovable estavam sincronizados no mesmo SHA antes da auditoria.

## Preflight real do Lovable Cloud

`portal_content_blocks` existe, possui RLS habilitada e estava vazia (`0` registros). O schema contém na mesma tabela `draft_title`, `draft_body`, `published_title`, `published_body` e `published_at`.

### Policies antes da correção

- `admin gerencia blocos do portal`: `FOR ALL`, condicionada a `has_admin_role(super_admin, admin, commercial)`;
- `qualquer visitante lê blocos do portal`: `SELECT USING (true)`.

### Grants antes da correção

- `anon`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`;
- `authenticated`: os mesmos privilégios amplos;
- `service_role`: os mesmos privilégios amplos;
- `sandbox_exec`: `SELECT` e `INSERT`, sendo uma role com `BYPASSRLS`;
- não existe sequence relacionada à tabela.

### Dependências

- views dependentes: nenhuma;
- materialized views dependentes: nenhuma;
- functions/RPCs dependentes: nenhuma;
- foreign keys: nenhuma;
- trigger: somente `portal_content_blocks_set_updated_at`, que chama `set_updated_at()`;
- nenhuma function `SECURITY DEFINER` encontrada referenciando a tabela.

### Consumidores

Não foi localizado consumidor atual de `portal_content_blocks`/`draft_*`/`published_*` no STAYO ADMIN nem no `joaovictorfer/STAYO.APP`. As rotas públicas atuais do Admin usam contratos próprios de convite/proposta e não consultam essa tabela.

Consequência: esta fase não cria view, RPC ou projeção pública.

### Storage

Não existe bucket identificado como pertencente a `portal_content_blocks`. Os buckets relacionados encontrados (`implementation-covers`, `owner-attachments`, `supply-documents`) são privados e pertencem a outros domínios. Nenhuma alteração de Storage faz parte da Fase 2A.

### Histórico de migrations

- a linha `supabase/migrations` termina em `0019_harden_opportunity_rpc_authorization.sql`;
- existe a contenção histórica `drizzle/migrations/0016_lock_down_portal_content_blocks.sql`, usada somente como referência técnica;
- o banco possui `drizzle.__drizzle_migrations`, mas não possui `supabase_migrations.schema_migrations`;
- as migrations 0017/0018/0019 da linha Supabase foram materializadas na Fase 1 e sua presença é comprovada pelo schema/RPCs e documentação, sem fabricação de linha de ledger.

## Testes pré-migration

Sem criar fixture:

- `anon` consegue executar `SELECT` na tabela e referenciar `draft_title` (0 linhas porque a tabela está vazia);
- `authenticated` com UUID sem `admin_profiles` também consegue executar `SELECT` e referenciar `draft_title` por causa da policy pública;
- o operador ativo `super_admin` resolve `current_admin_role() = super_admin` e mantém acesso legítimo.

O risco é estrutural mesmo com zero registros.

## Migration canônica desta fase

`supabase/migrations/0020_lock_down_portal_content_blocks.sql`

Objetivos do SQL:

1. manter RLS habilitada;
2. remover a policy pública ampla;
3. recriar a policy administrativa somente para `authenticated`, com `has_admin_role(...) IS TRUE`;
4. remover todos os grants de `PUBLIC` e `anon`;
5. reduzir `authenticated` a CRUD sujeito a RLS;
6. reduzir `service_role` a CRUD explícito;
7. remover os grants de `sandbox_exec`, que possui `BYPASSRLS`;
8. não criar qualquer superfície pública.

## Estado de execução

Aguardando materialização da `0020` e validação pós-migration. Este documento será atualizado com as evidências finais antes do merge.
