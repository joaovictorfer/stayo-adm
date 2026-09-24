# STAYO ADMIN — SCHEMA BASELINE

> Atualizado em: 24/09/2026  
> Escopo desta revisão: `portal_content_blocks`, migrations e autorização do gate P0  
> Status: **BASELINE REAL CONFIRMADO / P0 ENCERRADO**

## 1. Estado canônico

- Repositório: `joaovictorfer/stayo-adm`.
- Lovable Cloud: `Stayo Adm`.
- Project ID: `696b2125-0bf9-4538-8458-05d88fc5e8a2`.
- Banco do Admin: Lovable Cloud, stack Supabase.
- O conector Supabase separado não é fonte operacional deste projeto.

A Fase 2A foi executada em branch própria a partir da `main` `f3d07b0e816afcd9b8529c240708c0e5750a9a17`.

## 2. Governança e reconciliação de migrations

O repositório preserva duas linhas históricas:

- `drizzle/migrations`;
- `supabase/migrations`.

Regras mantidas:

- migrations já aplicadas não são alteradas;
- SQL histórico não é reaplicado fora de sequência;
- arquivo no GitHub não é, sozinho, prova de aplicação;
- novas alterações devem ser incrementais e versionadas.

O banco possui `drizzle.__drizzle_migrations` e não possui `supabase_migrations.schema_migrations`.

A antiga `drizzle/migrations/0016_lock_down_portal_content_blocks.sql` permaneceu somente como referência técnica e foi **supersedida para fins operacionais** pela migration canônica:

`supabase/migrations/0020_lock_down_portal_content_blocks.sql`

A linha Supabase efetivamente materializada no Lovable Cloud agora inclui:

- `0017_admin_opportunity_intake.sql`;
- `0018_lock_down_opportunity_rpcs.sql`;
- `0019_harden_opportunity_rpc_authorization.sql`;
- `0020_lock_down_portal_content_blocks.sql`.

Como o mecanismo autorizado de materialização via Lovable Cloud não cria automaticamente uma linha em `supabase_migrations`, nenhuma linha de ledger foi inventada. A aplicação da 0020 é comprovada pelo SQL exato versionado + estado pós-migration do catálogo/RLS/grants no banco correto.

## 3. Schema de `public.portal_content_blocks`

Colunas confirmadas:

| Coluna | Tipo | Nullable |
|---|---|---|
| `id` | uuid | não |
| `kind` | enum/user-defined | não |
| `draft_title` | text | não |
| `draft_body` | text | não |
| `published_title` | text | sim |
| `published_body` | text | sim |
| `published_at` | timestamptz | sim |
| `display_order` | integer | não |
| `created_at` | timestamptz | não |
| `updated_at` | timestamptz | não |

Estado final confirmado:

- total de registros: `0`;
- RLS: habilitada;
- nenhum dado sintético remanescente.

## 4. Estado anterior do P0

Antes da 0020 existiam:

### Policy pública

`qualquer visitante lê blocos do portal`

- comando: `SELECT`;
- condição: `true`.

### Grants públicos excessivos

`anon` possuía `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` e `TRIGGER`.

`authenticated` e `service_role` possuíam os mesmos privilégios amplos. `sandbox_exec`, uma role com `BYPASSRLS`, possuía `SELECT` e `INSERT`.

Como draft e publicação vivem na mesma linha, a policy pública tornava também `draft_title` e `draft_body` selecionáveis quando houvesse registros.

## 5. Estado atual após `0020`

Policies efetivamente presentes:

### `admin gerencia blocos do portal`

- comando: `ALL`;
- role: `authenticated`;
- `USING`: `has_admin_role(super_admin, admin, commercial) IS TRUE`;
- `WITH CHECK`: mesmo guard.

A policy `qualquer visitante lê blocos do portal` foi removida.

### Grants finais

**anon**

- nenhum grant na tabela.

**authenticated**

- `SELECT`;
- `INSERT`;
- `UPDATE`;
- `DELETE`;
- todos sujeitos à RLS/policy administrativa.

**service_role**

- `SELECT`;
- `INSERT`;
- `UPDATE`;
- `DELETE`.

**sandbox_exec**

- nenhum grant na tabela.

Não existe sequence relacionada.

## 6. Dependências reais

Confirmado no catálogo:

- nenhuma view dependente;
- nenhuma materialized view dependente;
- nenhuma função/RPC dependente da tabela;
- nenhuma FK dependente;
- somente o trigger técnico `portal_content_blocks_set_updated_at`, que chama `set_updated_at()`;
- nenhuma function `SECURITY DEFINER` relacionada expondo o conteúdo.

Busca nos repositórios `stayo-adm` e `STAYO.APP` não encontrou consumidor atual por nome da tabela nem pelos campos `draft_*`/`published_*`.

## 7. Provas de autorização pós-0020

### `anon`

`SELECT` direto é negado por falta de privilégio. Drafts não são acessíveis.

### `authenticated` sem papel administrativo

Com fixture sintética temporária existente, a leitura retornou `0` linhas e `INSERT` foi rejeitado por RLS.

### operador autorizado

O `super_admin` ativo manteve leitura e manutenção legítimas, inclusive `INSERT`, `UPDATE` e `DELETE` da fixture sintética.

A fixture foi removida; a tabela voltou a `0` registros.

## 8. Superfície pública

Nenhum consumidor público legítimo foi comprovado. Portanto não foi criada view, RPC ou projeção pública.

Se o Guia ou outra experiência pública exigir esse conteúdo no futuro, deverá ser criada nova migration incremental com projeção `published-only`, mínima e explícita. A tabela base não deve voltar a receber `SELECT` público.

## 9. Storage

Não foi identificado bucket associado a `portal_content_blocks`. Nenhuma mudança de Storage foi necessária.

## 10. Resultado

**BASELINE REAL ATUALIZADO. O P0 DE `portal_content_blocks` ESTÁ ENCERRADO NO LOVABLE CLOUD.**

Pendências de proposta, reunião, convite/Owner Journey, Core e integrações pertencem a fases posteriores e não alteram este resultado.
