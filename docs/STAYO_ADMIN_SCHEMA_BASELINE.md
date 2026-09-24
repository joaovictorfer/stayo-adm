# STAYO ADMIN — SCHEMA BASELINE

> Fase A / Contenção P0  
> Atualizado em: 23/09/2026  
> Escopo desta revisão: `portal_content_blocks`, migrations e autorização necessária para a contenção P0  
> Status: **BASELINE REAL CONFIRMADO / P0 AINDA NÃO APLICADO**

Este documento substitui o antigo estado “banco produtivo não acessível”. O banco correto do STAYO ADMIN foi consultado em leitura pelo Lovable Cloud. A aplicação de DDL permanece bloqueada porque o conector Supabase disponível não possui acesso ao projeto configurado pelo Admin.

## 1. Estado canônico

### GitHub

- Repositório: `joaovictorfer/stayo-adm`.
- Branch: `main`.
- HEAD confirmado antes desta atualização: `91afdfd90c1efdbaf3a9a1680e2d989110d40302`.

### Lovable

- Projeto: `Stayo Adm`.
- Project ID: `696b2125-0bf9-4538-8458-05d88fc5e8a2`.
- `latest_commit_sha` confirmado igual ao HEAD acima antes das atualizações documentais.
- Banco habilitado: sim.
- Stack: Supabase.

### Supabase

O STAYO ADMIN está configurado para o projeto ref:

`dftzonhzxsqghxrvgkkt`

O conector Supabase disponível nesta sessão lista apenas:

`jsxwyewasvcxkgbpbdvk`

Esse projeto não corresponde ao Admin e aparece `INACTIVE`. Uma tentativa read-only nele falhou por timeout. A consulta direta do projeto correto `dftzonhzxsqghxrvgkkt` pelo conector retornou falta de permissão.

**Decisão:** não restaurar nem aplicar migration no projeto errado e não usar Lovable como atalho para DDL.

## 2. Governança de migrations

O repositório mantém duas linhas históricas:

- `drizzle/migrations`;
- `supabase/migrations`.

A decisão aprovada permanece:

- não reaplicar migrations históricas;
- não renumerar artificialmente migrations já publicadas;
- não considerar arquivo SQL como prova de aplicação;
- tratar `supabase/migrations` como autoridade futura somente após reconciliação formal;
- nesta contenção, respeitar o histórico real hoje registrado em `drizzle.__drizzle_migrations`.

### Histórico real confirmado

`drizzle.__drizzle_migrations` existe no Cloud e o último registro confirmado é:

- `id = 28`;
- `created_at = 1790181469883`.

Esse timestamp corresponde à última migration anterior à nova contenção 0016.

`supabase_migrations.schema_migrations` não existe neste banco.

### Migration P0 versionada

`drizzle/migrations/0016_lock_down_portal_content_blocks.sql`

Estado real: **PENDENTE / NÃO APLICADA**.

## 3. Schema real de `public.portal_content_blocks`

Colunas confirmadas diretamente no banco:

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

Contagem atual:

- total: 0;
- publicadas: 0;
- não publicadas: 0.

## 4. RLS/policies reais

Policies efetivamente presentes antes da aplicação da contenção:

### `admin gerencia blocos do portal`

- comando: ALL;
- roles: PUBLIC/policy geral;
- condição: `has_admin_role(super_admin, admin, commercial)`;
- `WITH CHECK`: mesma condição.

### `qualquer visitante lê blocos do portal`

- comando: SELECT;
- condição: `true`.

Esta segunda policy é o P0 estrutural. Como draft e publicação vivem na mesma linha, ela torna a linha completa elegível à leitura pública quando existir conteúdo.

## 5. Grants reais

Grants confirmados em `information_schema.role_table_grants`:

### `anon`

- SELECT;
- INSERT;
- UPDATE;
- DELETE;
- TRUNCATE;
- REFERENCES;
- TRIGGER.

### `authenticated`

- SELECT;
- INSERT;
- UPDATE;
- DELETE;
- TRUNCATE;
- REFERENCES;
- TRIGGER.

### `service_role`

- SELECT;
- INSERT;
- UPDATE;
- DELETE;
- TRUNCATE;
- REFERENCES;
- TRIGGER.

RLS restringe operações de staff, mas a policy pública `SELECT USING (true)` neutraliza a proteção de leitura para qualquer linha existente.

## 6. Dependências reais

Consultas ao catálogo do PostgreSQL confirmaram:

- nenhuma view referencia `portal_content_blocks`;
- nenhuma função regular referencia `portal_content_blocks`.

Busca nos repositórios canônicos `stayo-adm` e `STAYO.APP` não encontrou consumidor atual por nome da tabela nem por `published_title`.

**Conclusão:** não existe dependência pública comprovada que justifique manter leitura direta da tabela base.

## 7. Provas de autorização reproduzidas

### `anon`

Foi executado `SELECT` sob role `anon`. A consulta à tabela base funcionou e pôde referenciar `draft_title`. Retornou 0 linhas porque a tabela está vazia.

**Estado:** acesso estrutural indevido CONFIRMADO.

### `authenticated` sem vínculo

Foi simulada uma sessão `authenticated` com UUID sem vínculo. A consulta à tabela base funcionou e pôde referenciar `draft_title`. Retornou 0 linhas porque a tabela está vazia.

**Estado:** acesso estrutural indevido CONFIRMADO.

### operador autorizado

Foi simulada a sessão do `super_admin` ativo. `has_admin_role(super_admin, admin, commercial)` retornou `true` e a leitura interna foi permitida.

**Estado:** acesso interno legítimo CONFIRMADO.

## 8. Contenção requerida

A migration 0016 representa exatamente a contenção necessária para esta fase:

1. remover a policy pública `qualquer visitante lê blocos do portal`;
2. revogar privilégios de tabela de `anon`;
3. preservar staff via policy administrativa;
4. não criar atalho público na tabela base;
5. futura exposição pública, se necessária, deve ser uma projeção `published-only`.

Não foi identificada divergência de schema que exija alterar a migration.

## 9. Aplicação produtiva

**NÃO EXECUTADA.**

Bloqueio operacional comprovado:

- o conector Supabase não tem acesso ao ref `dftzonhzxsqghxrvgkkt`;
- o único projeto disponível é outro ref;
- usar Lovable para DDL é proibido pelo fluxo operacional do projeto.

Nenhuma migration foi falsamente registrada como aplicada.

## 10. Baseline de aceite pós-migration

Após obter acesso ao projeto correto e aplicar a 0016 pelo mecanismo Supabase/migration apropriado, repetir:

1. verificar ausência da policy pública;
2. verificar ausência de grants de `anon` na tabela base;
3. `anon` deve receber `permission denied`/negação equivalente ao tentar consultar a tabela base;
4. `authenticated` sem autorização deve ser negado;
5. operador autorizado deve continuar lendo/editando;
6. eventual projeção pública deve retornar somente campos published-only;
7. confirmar registro de migration no histórico real;
8. validar consumidor público em navegador somente se existir contrato/fixture apropriado.

## 11. Pendências fora deste baseline

Permanecem para fases próprias, sem alteração nesta execução:

- `supabase/migrations/0016_owner_journey_proposal.sql`;
- RPCs da nova Owner Journey ainda ausentes;
- proposta;
- localStorage;
- Core API;
- conversão de imóveis;
- integrações e operação.

## 12. Resultado

**BASELINE REAL ATUALIZADO. P0 BLOQUEADO POR ACESSO OPERACIONAL AO SUPABASE CORRETO.**