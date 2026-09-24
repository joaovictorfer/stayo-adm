# STAYO ADMIN — FASE A / VALIDAÇÃO REAL E CONTENÇÃO P0

> Data de execução: 23/09/2026  
> Escopo: contenção do acesso público a `public.portal_content_blocks`  
> Repositório: `joaovictorfer/stayo-adm` / `main`  
> Lovable: `Stayo Adm` (`696b2125-0bf9-4538-8458-05d88fc5e8a2`)  
> Status: **P0 BLOQUEADO — migration correta e pendente; aplicação produtiva não autorizável pelo conector Supabase disponível**

## 1. Estado canônico confirmado

- HEAD da `main` antes desta execução: `91afdfd90c1efdbaf3a9a1680e2d989110d40302`.
- O Lovable retornou o mesmo `latest_commit_sha`; GitHub e Lovable estavam sincronizados antes das atualizações documentais desta execução.
- O banco do Lovable Admin está habilitado e reporta stack Supabase.
- A configuração versionada do Admin aponta para o projeto Supabase ref `dftzonhzxsqghxrvgkkt`.
- O conector Supabase disponível nesta sessão lista apenas `jsxwyewasvcxkgbpbdvk`, com status `INACTIVE`.
- Consulta direta do ref correto `dftzonhzxsqghxrvgkkt` pelo conector Supabase retornou **sem permissão**.

**Conclusão operacional:** o banco correto pôde ser auditado em leitura pelo Lovable Cloud, mas o conector apto a executar migrations não está conectado ao projeto Supabase do Admin. Nenhum DDL foi executado pelo Lovable.

## 2. Migration 0016 — gate real

Arquivo versionado:

`drizzle/migrations/0016_lock_down_portal_content_blocks.sql`

A migration faz apenas:

1. `DROP POLICY IF EXISTS "qualquer visitante lê blocos do portal"` na tabela base;
2. `REVOKE ALL PRIVILEGES ON TABLE public.portal_content_blocks FROM anon`;
3. preserva o acesso `authenticated` sujeito às policies administrativas existentes;
4. não cria view/RPC pública e não expõe `draft_*`.

### Histórico aplicado no banco

`drizzle.__drizzle_migrations` foi consultada diretamente no Lovable Cloud. O último registro continua:

- `id = 28`;
- `created_at = 1790181469883`;
- hash correspondente à última migration anterior à 0016.

O schema `supabase_migrations` não possui `schema_migrations` neste Cloud.

**Conclusão:** a 0016 está **PENDENTE**, não aplicada e não divergente por histórico alternativo.

## 3. Estado real de `portal_content_blocks`

Colunas confirmadas no banco:

- `id`;
- `kind`;
- `draft_title`;
- `draft_body`;
- `published_title`;
- `published_body`;
- `published_at`;
- `display_order`;
- `created_at`;
- `updated_at`.

Contagem atual:

- total: `0`;
- publicadas: `0`;
- não publicadas: `0`.

### Policies presentes

1. `admin gerencia blocos do portal`
   - comando: `ALL`;
   - condição: `has_admin_role(super_admin, admin, commercial)`.
2. `qualquer visitante lê blocos do portal`
   - comando: `SELECT`;
   - condição: `true`.

### Grants efetivos relevantes

Antes da contenção:

- `anon`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`;
- `authenticated`: mesmos privilégios de tabela, com RLS governando linha;
- `service_role`: mesmos privilégios de tabela.

A policy pública `USING (true)` torna a leitura anônima da linha inteira possível. Como `draft_*` e `published_*` coexistem na mesma linha, filtrar apenas `published_at` não protegeria o draft se a tabela base continuasse pública.

## 4. Dependências e consumidores

No banco real:

- nenhuma view referencia `portal_content_blocks`;
- nenhuma função regular referencia `portal_content_blocks`.

No código atual pesquisado em:

- `joaovictorfer/stayo-adm`;
- `joaovictorfer/STAYO.APP`;

não foi localizado consumidor por `portal_content_blocks` nem pelos campos `published_title`.

**Conclusão:** não existe consumo público legítimo comprovado que exija manter `SELECT` na tabela base.

## 5. Testes pré-contenção reproduzidos

Os testes abaixo foram executados em transação/role temporária e sem fixture sensível.

### 5.1 `anon`

Consulta à tabela base executou com sucesso e pôde referenciar `draft_title`.

Resultado: `0` linhas apenas porque a tabela está vazia.

**Resultado:** FALHA DE AUTORIZAÇÃO ESTRUTURAL REPRODUZIDA.

### 5.2 `authenticated` sem vínculo

Sessão simulada com UUID sem vínculo conseguiu executar `SELECT` na tabela base e referenciar `draft_title`.

Resultado: `0` linhas apenas porque a tabela está vazia.

**Resultado:** FALHA DE AUTORIZAÇÃO ESTRUTURAL REPRODUZIDA.

### 5.3 operador autorizado

Sessão `authenticated` usando o único `super_admin` ativo confirmou:

- `has_admin_role(super_admin, admin, commercial) = true`;
- leitura da tabela base permitida.

**Resultado:** acesso interno legítimo existente antes da contenção foi comprovado.

## 6. Aplicação da contenção

### Decisão

A migration **não foi aplicada** nesta execução.

Motivo objetivo:

- a aplicação DDL deve ocorrer pelo projeto Supabase correto;
- o conector Supabase disponível não possui permissão sobre `dftzonhzxsqghxrvgkkt`;
- o único projeto visível no conector é outro ref (`jsxwyewasvcxkgbpbdvk`);
- aplicar no projeto errado seria uma alteração de produção sem identidade de destino comprovada;
- executar DDL pelo Lovable violaria o fluxo operacional definido para o projeto.

Nenhuma migration foi marcada como executada manualmente e nenhum histórico foi adulterado.

## 7. Verificação pós-aplicação

**NÃO EXECUTADA**, porque a migration não pôde ser aplicada no projeto correto.

Consequências para o gate:

- `anon` ainda possui grant e policy que permitem consultar a tabela base;
- não há evidência pós-DDL de bloqueio;
- não há evidência pós-DDL de manutenção do acesso interno;
- não há registro da 0016 em `drizzle.__drizzle_migrations`.

Portanto, a contenção **não pode ser declarada concluída**.

## 8. Browser / fluxo público

Não existe consumidor público comprovado de `portal_content_blocks` nos repositórios auditados, e a tabela está vazia.

Não foram criadas fixtures apenas para satisfazer teste visual. Assim, não foi possível validar estados `conteúdo publicado`/`erro` em navegador sem inventar um fluxo inexistente ou gravar dados de produção.

Estado vazio da aplicação geral permanece observável no preview, mas isso **não prova** a contenção da tabela.

## 9. Rollback seguro da futura aplicação

A futura contenção remove apenas acesso público direto. Se algum consumidor legítimo inesperado quebrar, o rollback seguro **não** é restaurar `SELECT` anônimo na tabela base.

O rollback funcional permitido é:

1. manter a tabela base privada;
2. criar migration incremental com view/RPC explicitamente `published-only`;
3. expor apenas `id`, `kind`, `published_title`, `published_body`, `published_at`, `display_order` — ou subconjunto menor comprovadamente necessário;
4. nunca incluir `draft_title` ou `draft_body`;
5. testar com `anon`, `authenticated` sem autorização e operador interno antes de liberar.

## 10. Fora do escopo desta execução

Não foram alterados/aplicados:

- `supabase/migrations/0016_owner_journey_proposal.sql`;
- RPCs de convite/jornada ainda ausentes;
- proposta;
- localStorage;
- Core API;
- conversão de imóveis;
- integrações, reservas, cobranças ou mensagens.

## 11. Critério de aceite

A frente só será liberada quando, no projeto `dftzonhzxsqghxrvgkkt`:

1. a migration 0016 for aplicada pelo mecanismo Supabase/migration correto;
2. `anon` não possuir `SELECT` na tabela base;
3. a policy pública `USING (true)` não existir;
4. `authenticated` sem autorização não conseguir ler a tabela base;
5. operador autorizado continuar gerenciando os blocos;
6. eventual superfície pública retornar somente published-only;
7. o histórico aplicado registrar a migration correspondente;
8. os testes pós-aplicação forem repetidos.

## 12. Resultado

**P0 BLOQUEADO.**

Causa: o conector Supabase desta sessão não tem acesso ao projeto Supabase configurado pelo STAYO ADMIN. A próxima ação concreta é conectar/autorizar no conector Supabase o projeto `dftzonhzxsqghxrvgkkt`; depois aplicar a 0016 por `apply_migration` no projeto correto e repetir integralmente a seção de verificação obrigatória.