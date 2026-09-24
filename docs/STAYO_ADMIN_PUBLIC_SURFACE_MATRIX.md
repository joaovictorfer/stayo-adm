# STAYO ADMIN — MATRIZ DE SUPERFÍCIE PÚBLICA

> Atualizado em: 24/09/2026  
> Escopo desta revisão: `portal_content_blocks` e seus caminhos públicos diretos/indiretos  
> Status: **P0 ENCERRADO / CONTENÇÃO COMPROVADA NO BANCO**

## 1. Identidades usadas

- `anon`: role pública sem sessão;
- `authenticated sem papel`: role autenticada com UUID sem `admin_profiles` autorizado;
- `operador autorizado`: sessão autenticada do `super_admin` ativo.

Foi usada somente uma fixture sintética, sem PII, removida ao final.

## 2. Matriz antes/depois

| Superfície | Identidade | Antes da 0020 | Depois da 0020 |
|---|---|---|---|
| tabela base `public.portal_content_blocks` | `anon` | **PERMITIDO**; podia referenciar `draft_title` | **NEGADO** por ausência de grant |
| tabela base `public.portal_content_blocks` | `authenticated` sem papel | **PERMITIDO** pela policy pública | **NEGADO** pela RLS; fixture existente retornou 0 linhas |
| escrita na tabela base | `authenticated` sem papel | grant amplo, sujeito a policies | **NEGADA** pela RLS |
| tabela base | operador autorizado | permitido legitimamente | **PERMITIDO** via policy administrativa |
| manutenção `INSERT/UPDATE/DELETE` | operador autorizado | permitido | **PERMITIDO** e testado com fixture sintética |
| policy `qualquer visitante lê blocos do portal` | qualquer role | **PRESENTE — SELECT USING (true)** | **AUSENTE** |
| grants de tabela | `anon` | todos os privilégios de tabela | **NENHUM** |
| grants de tabela | `authenticated` | privilégios amplos inclusive TRUNCATE/REFERENCES/TRIGGER | somente `SELECT/INSERT/UPDATE/DELETE`, sujeitos à RLS |
| grants de tabela | `sandbox_exec` | `SELECT/INSERT`, com BYPASSRLS | **NENHUM** |
| view/materialized view baseada na tabela | público | não existia | continua inexistente |
| RPC/function baseada na tabela | público/auth | não existia | continua inexistente |
| consumidor no `stayo-adm` | público | não localizado | não localizado |
| consumidor no `STAYO.APP` | público | não localizado | não localizado |

## 3. Por que a tabela base permanece totalmente fechada ao público

A mesma linha contém:

- `draft_title`;
- `draft_body`;
- `published_title`;
- `published_body`;
- `published_at`.

Filtrar somente linhas com `published_at is not null` na tabela base não seria suficiente, porque o cliente ainda poderia selecionar as colunas `draft_*` da mesma linha.

A contenção correta é a aplicada pela `supabase/migrations/0020_lock_down_portal_content_blocks.sql`: nenhuma leitura pública da tabela base.

## 4. Consumidor público legítimo

Nenhum consumidor atual foi comprovado no banco, no STAYO ADMIN ou no STAYO APP/Core. Portanto a Fase 2A não criou view/RPC pública.

Se houver necessidade futura, o contrato deverá nascer em migration incremental e expor apenas os campos publicados estritamente necessários, por exemplo:

- `id`;
- `kind`;
- `published_title`;
- `published_body`;
- `published_at`;
- `display_order`.

Nunca `draft_title`, `draft_body`, `SELECT *`, notas internas ou PII.

## 5. Migration e reconciliação

Migration canônica aplicada:

`supabase/migrations/0020_lock_down_portal_content_blocks.sql`

A antiga `drizzle/migrations/0016_lock_down_portal_content_blocks.sql` permanece histórica e foi usada somente como referência; não foi executada fora de sequência.

O Lovable Cloud não possui `supabase_migrations.schema_migrations`. A 0020 foi materializada pelo mecanismo autorizado do Lovable Cloud usando exatamente o arquivo versionado no GitHub; a prova pós-aplicação é o catálogo real de policies/grants/RLS e os testes por identidade.

## 6. API indireta / REST / RPC

- não existe view ou RPC baseada em `portal_content_blocks`;
- `anon` não possui grant na tabela base, portanto a API automática não possui caminho de leitura da tabela para esse papel;
- `authenticated` comum é filtrado pela policy administrativa e não consegue acessar a fixture;
- não foi criado endpoint substituto nesta fase.

## 7. Storage

Nenhum bucket relacionado a `portal_content_blocks` foi identificado. Os buckets auditados que pertencem a outros domínios não foram alterados.

## 8. Regressão de aplicação

Smoke Playwright do run `36039414015` executado com sucesso em `375x812` e `1280x900`:

- `/portal/implantacao/<token-inexistente>` mantém fallback seguro e não exibe conteúdo draft;
- `/portal/proposta/<token-inexistente>` mantém fallback seguro;
- `/implantacao` continua renderizando a área administrativa no adapter local;
- sem overflow horizontal nos viewports testados.

A prova de autorização do operador em ambiente real foi feita separadamente no Lovable Cloud com `super_admin`.

## 9. Resultado

**P0 ENCERRADO.** `portal_content_blocks` não é mais uma superfície pública direta ou indireta conhecida. Qualquer exposição futura de conteúdo publicado exigirá contrato público novo, mínimo e explicitamente versionado.
