# STAYO ADMIN — MATRIZ DE SUPERFÍCIE PÚBLICA

> Fase A / Contenção P0  
> Atualizado em: 23/09/2026  
> Escopo desta revisão: `portal_content_blocks` e seus caminhos públicos diretos/indiretos  
> Status: **PROVA NO BANCO CONCLUÍDA / CONTENÇÃO AINDA NÃO APLICADA**

Esta matriz substitui o estado anterior “prova no banco bloqueada” para a superfície P0 auditada. Outras superfícies do Portal permanecem fora do escopo desta execução e não são reclassificadas aqui sem necessidade.

## 1. Identidades usadas nos testes

- `anon`: role pública sem sessão.
- `authenticated sem vínculo`: role autenticada com UUID sem owner/admin vinculado.
- `operador autorizado`: sessão autenticada do `super_admin` ativo, usada apenas para provar o caminho interno legítimo.

Nenhum dado real sensível foi usado como fixture.

## 2. Matriz verificada

| Superfície | Identidade | Estado real antes da 0016 | Evidência | Estado esperado após 0016 |
|---|---|---|---|---|
| tabela base `public.portal_content_blocks` | `anon` | **PERMITIDO** | `SELECT` executa e consegue referenciar `draft_title`; 0 linhas por tabela vazia | **NEGADO** |
| tabela base `public.portal_content_blocks` | `authenticated` sem vínculo | **PERMITIDO** | `SELECT` executa e consegue referenciar `draft_title`; 0 linhas por tabela vazia | **NEGADO** pela policy administrativa |
| tabela base `public.portal_content_blocks` | operador autorizado | **PERMITIDO LEGITIMAMENTE** | `has_admin_role(super_admin, admin, commercial)=true` e leitura permitida | **PERMITIDO** |
| policy `qualquer visitante lê blocos do portal` | qualquer role | **PRESENTE** | comando `SELECT`, condição `true` | **AUSENTE** |
| grant de tabela para `anon` | `anon` | **PRESENTE** | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` | **AUSENTE** |
| view pública baseada em `portal_content_blocks` | `anon` | **NÃO EXISTE** | catálogo `pg_views` sem referência | continuar inexistente nesta fase |
| RPC/função baseada em `portal_content_blocks` | `anon`/auth | **NÃO EXISTE** | catálogo `pg_proc` sem função regular que referencie a tabela | continuar inexistente nesta fase |
| consumidor no `stayo-adm` | público | **NÃO LOCALIZADO** | busca por `portal_content_blocks` e `published_title` sem resultado | sem mudança funcional esperada |
| consumidor no `STAYO.APP` | público | **NÃO LOCALIZADO** | busca por `portal_content_blocks` e `published_title` sem resultado | sem mudança funcional esperada |

## 3. Schema que torna a policy atual perigosa

A mesma linha contém:

- `draft_title`;
- `draft_body`;
- `published_title`;
- `published_body`;
- `published_at`.

Portanto, uma policy do tipo `published_at is not null` aplicada à **tabela base** não seria contenção suficiente: ao receber a linha, o cliente ainda poderia selecionar as colunas `draft_*`.

A contenção correta é fechar a tabela base para o público.

## 4. Consumidor público legítimo

Nenhum consumidor legítimo atual foi comprovado no banco ou nos dois repositórios canônicos pesquisados.

Por isso a migration 0016 não cria view/RPC pública.

Se a integração com o Guia exigir leitura pública no futuro, o contrato deve nascer em migration incremental e expor somente campos published-only, por exemplo:

- `id`;
- `kind`;
- `published_title`;
- `published_body`;
- `published_at`;
- `display_order`.

Nunca `draft_title`, `draft_body` ou `SELECT *` da tabela base.

## 5. Gate de migration

Migration versionada:

`drizzle/migrations/0016_lock_down_portal_content_blocks.sql`

Estado real confirmado:

- não aplicada;
- histórico `drizzle.__drizzle_migrations` ainda termina na migration anterior;
- `supabase_migrations.schema_migrations` não existe neste Cloud;
- policy pública ainda presente;
- grants de `anon` ainda presentes.

## 6. Motivo da não aplicação

O Admin está configurado para o projeto Supabase ref `dftzonhzxsqghxrvgkkt`.

O conector Supabase desta sessão:

- não lista esse projeto;
- lista apenas `jsxwyewasvcxkgbpbdvk`;
- retorna falta de permissão quando o ref correto é consultado diretamente.

Não foi usado o projeto errado e não foi executado DDL pelo Lovable.

## 7. Testes pós-aplicação obrigatórios

Assim que a 0016 for aplicada no projeto correto:

| Caso | Resultado obrigatório |
|---|---|
| `anon` consulta tabela base | negado |
| `anon` tenta selecionar `draft_title`/`draft_body` | negado |
| auth sem vínculo consulta tabela base | negado |
| operador autorizado consulta tabela base | permitido |
| operador autorizado edita bloco | permitido conforme policy interna |
| grants de `anon` | nenhum na tabela base |
| policy `USING (true)` | ausente |
| eventual view/RPC pública | somente published-only |
| histórico de migrations | contém a contenção aplicada |

## 8. Browser

A tabela está vazia e não existe consumidor público comprovado dessa superfície. Não foram criadas fixtures de produção apenas para simular estados publicados.

Logo:

- estado vazio do produto não comprova segurança desta tabela;
- estado publicado não foi testado por ausência de fixture/consumer legítimo;
- após eventual criação de projeção pública futura, os estados `vazio`, `erro` e `publicado` deverão ser verificados em navegador independente.

## 9. Resultado

**P0 BLOQUEADO.**

A falha estrutural está comprovada e a migration correta está versionada, mas o banco produtivo ainda não foi alterado. A próxima ação é conectar/autorizar o projeto Supabase `dftzonhzxsqghxrvgkkt` no conector de migrations e, então, aplicar a 0016 e repetir toda a seção de testes pós-aplicação.