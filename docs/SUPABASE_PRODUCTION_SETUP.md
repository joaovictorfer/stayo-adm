# Configuração do Supabase para produção

## Projeto já provisionado (não inventado)

Este repositório (`joaovictorfer/stayo-adm`) está conectado a um projeto
**Lovable Cloud** chamado "Stayo Adm" (`project_id:
696b2125-0bf9-4538-8458-05d88fc5e8a2`, `workspace_id:
be3LovrbEIiRu9X0Pk2j`) — confirmado cruzando o `latest_commit_sha` que o
Lovable reporta com o SHA base deste branch no GitHub. O Lovable
provisiona e gerencia um banco Postgres/Supabase real por baixo desse
projeto; toda a auditoria de schema/RLS documentada em
`docs/RLS_MATRIX.md` e `docs/LOCALSTORAGE_MIGRATION.md` foi executada
contra esse banco real, via a ferramenta `mcp__Lovable__query_database`
(SQL direto, com privilégio elevado — usado só para DDL/testes de RLS,
nunca para inventar dado de produção).

**O que isso NÃO dá acesso**: as credenciais públicas
(`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) que o frontend precisa
para falar com esse banco via `@supabase/supabase-js` continuam
desconhecidas nesta sessão. O Lovable injeta essas variáveis
automaticamente **só quando ele mesmo builda e publica o app** — este
checkout (Claude Code, build via Vite/TanStack Start/Cloudflare Workers)
é um alvo de deploy independente, que não recebe essa injeção. Isto é um
`BLOCKED_EXTERNAL_CREDENTIAL` real, não uma escolha — nenhuma credencial
foi inventada em lugar nenhum do código ou dos testes.

## Migrations (schema completo, todas aplicadas e validadas contra o banco real)

| # | Arquivo | Conteúdo |
| - | ------- | -------- |
| 0001 | `0001_admin_foundation.sql` | `admin_role` enum, `admin_profiles`, `audit_logs`, `has_admin_role()`/`current_admin_role()` |
| 0002 | `0002_owner_records.sql` | `owner_records` |
| 0003 | `0003_commercial_terms.sql` | `commercial_term_defaults`, `commercial_terms` |
| 0004 | `0004_owner_portal_invitations.sql` | `owner_portal_invitations` (schema — RPC pública só na 0007) |
| 0005 | `0005_outbound_messages.sql` | `outbound_messages` |
| 0006 | `0006_initial_charges.sql` | `initial_charges` |
| 0007 | `0007_owner_onboarding_submissions.sql` | `owner_onboarding_submissions` + RPCs públicas do convite |
| 0008 | `0008_admin_auth_bootstrap.sql` | policy de bootstrap do 1º `super_admin` |
| 0009 | `0009_implementation_projects.sql` | `implementation_projects`, `implementation_items` |
| 0010 | `0010_proposals.sql` | `proposals`, `proposal_share_links` + RPCs públicas da proposta |
| 0011 | `0011_checklist_templates.sql` | `checklist_templates` |
| 0012 | `0012_owner_notes.sql` | `owner_notes` |

Todas em `supabase/migrations/`, em ordem, sem gaps — aplicar em sequência
contra qualquer projeto Supabase novo reproduz o schema exato validado
aqui. Nenhuma foi excluída ou reescrita depois de aplicada.

## O que falta para este checkout (Claude Code) rodar contra o Supabase real

1. Obter `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do projeto Lovable
   (via painel do Supabase associado, ou o próprio Lovable expondo essas
   chaves) e configurá-las como variáveis de ambiente deste deploy
   (Cloudflare Workers/Wrangler, ou `.env.local` em desenvolvimento).
2. Nada além disso — `isSupabaseConfigured()` (`src/lib/api/supabase-client.ts`)
   já troca todo `AdminApiClient` do adapter local para o Supabase
   automaticamente assim que as duas variáveis existem, sem qualquer
   outra mudança de código.
3. Rodar o importador (`/configuracoes/migracao`) uma vez, se houver dado
   de protótipo em `localStorage` a preservar (ver
   `docs/LOCALSTORAGE_MIGRATION.md`).
4. Criar o primeiro usuário via `/login` → "Criar o primeiro acesso" —
   vira `super_admin` automaticamente enquanto `admin_profiles` estiver
   vazia (migration `0008`).

## Nunca fazer (mesmo sob pressão de "fazer funcionar")

- Nunca colocar `service_role` em `VITE_*` ou em qualquer código que vai
  para o bundle do navegador — só `anon` é seguro no cliente, porque toda
  autorização real vive na RLS, não na chave em si.
- Nunca desabilitar RLS "para destravar" um teste — se uma policy parece
  errada, corrigir a policy (como o bug de bootstrap corrigido na
  migration `0008`), nunca `disable row level security`.
- Nunca usar `using (true)` numa policy de tabela com dado de negócio real.
