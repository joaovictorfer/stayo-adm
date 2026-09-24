# STAYO ADMIN — Fase 2A / gate de segurança do portal público

Data: 24/09/2026

## Veredito técnico

**P0 ENCERRADO NO LOVABLE CLOUD.** A tabela interna `public.portal_content_blocks` não possui mais leitura pública; drafts não são acessíveis por `anon`, por usuário `authenticated` comum, por view ou por RPC; o acesso administrativo legítimo foi preservado.

## Estado canônico

- repositório: `joaovictorfer/stayo-adm`;
- `main` inicial desta fase: `f3d07b0e816afcd9b8529c240708c0e5750a9a17`;
- branch: `phase2a-portal-content-security`;
- PR: #30;
- Lovable: `Stayo Adm`;
- Project ID: `696b2125-0bf9-4538-8458-05d88fc5e8a2`;
- GitHub e Lovable estavam sincronizados no mesmo SHA antes da auditoria.

## Preflight real do Lovable Cloud

`portal_content_blocks` existia com RLS habilitada e `0` registros. A mesma linha contém `draft_title`, `draft_body`, `published_title`, `published_body` e `published_at`.

Antes da correção:

- policy `admin gerencia blocos do portal`: `FOR ALL` com `has_admin_role(super_admin, admin, commercial)`;
- policy `qualquer visitante lê blocos do portal`: `SELECT USING (true)`;
- `anon`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`;
- `authenticated`: os mesmos privilégios amplos;
- `service_role`: os mesmos privilégios amplos;
- `sandbox_exec`: `SELECT` e `INSERT`, com `BYPASSRLS`;
- nenhuma sequence relacionada.

Sem fixture, `anon` e um `authenticated` sem `admin_profiles` conseguiam executar `SELECT` e referenciar `draft_title`. O resultado era vazio somente porque a tabela estava vazia. O `super_admin` ativo mantinha acesso legítimo.

## Dependências e consumidores

Auditoria de catálogo e código confirmou:

- nenhuma view dependente;
- nenhuma materialized view dependente;
- nenhuma function/RPC dependente de `portal_content_blocks`;
- nenhuma FK dependente;
- trigger somente `portal_content_blocks_set_updated_at`, chamando `set_updated_at()`;
- nenhuma function `SECURITY DEFINER` expondo essa tabela;
- nenhum consumidor atual por `portal_content_blocks`, `draft_*` ou `published_*` no STAYO ADMIN ou no `joaovictorfer/STAYO.APP`.

Por isso a Fase 2A **não criou** view, RPC ou projeção pública.

## Storage

Não foi identificado bucket pertencente a esse domínio. `implementation-covers`, `owner-attachments` e `supply-documents` são de outros domínios e permanecem sem alteração nesta fase.

## Reconciliação de migrations

O repositório conserva duas linhas históricas:

- `drizzle/migrations`;
- `supabase/migrations`.

A antiga `drizzle/migrations/0016_lock_down_portal_content_blocks.sql` foi usada somente como referência técnica e **não foi aplicada fora de sequência**.

A linha usada para novas mudanças já materializadas na Fase 1 termina em:

- `0017_admin_opportunity_intake.sql`;
- `0018_lock_down_opportunity_rpcs.sql`;
- `0019_harden_opportunity_rpc_authorization.sql`.

A contenção canônica desta fase foi criada como:

`supabase/migrations/0020_lock_down_portal_content_blocks.sql`

O Lovable Cloud possui `drizzle.__drizzle_migrations`, mas não possui `supabase_migrations.schema_migrations`. A materialização de `supabase/migrations` autorizada neste Work não cria automaticamente uma linha nesse ledger; nenhuma linha de histórico foi fabricada. A prova de aplicação é o SQL versionado executado no Project ID correto e o estado pós-migration comprovado no catálogo/RLS/grants.

## Migration 0020

A migration:

1. mantém RLS habilitada;
2. remove a policy pública ampla;
3. recria a policy administrativa somente para `authenticated` com `has_admin_role(...) IS TRUE` em `USING` e `WITH CHECK`;
4. revoga todos os privilégios de `PUBLIC` e `anon`;
5. reduz `authenticated` a `SELECT`, `INSERT`, `UPDATE`, `DELETE`, sujeitos à RLS;
6. reduz `service_role` ao mesmo CRUD explícito;
7. revoga os grants de `sandbox_exec` sobre a tabela;
8. não cria superfície pública e não altera dados.

### Método de aplicação

Foi confirmado o projeto Lovable `Stayo Adm`, Project ID `696b2125-0bf9-4538-8458-05d88fc5e8a2`. Após preflight sem divergência, o conteúdo exato de `supabase/migrations/0020_lock_down_portal_content_blocks.sql`, lido de volta do GitHub, foi materializado pelo `query_database` do Lovable Cloud, conforme a autorização operacional do Work. Nenhum SQL improvisado ou não versionado foi aplicado como migration.

## Estado pós-migration comprovado

Fotografia final do banco:

- registros: `0`;
- RLS: `true`;
- policy pública `qualquer visitante lê blocos do portal`: **ausente**;
- única policy da tabela: `admin gerencia blocos do portal`, `ALL`, role `authenticated`, guard `has_admin_role(...) IS TRUE`;
- `anon`: **nenhum grant** na tabela;
- `authenticated`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, sujeitos à RLS;
- `service_role`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`;
- `sandbox_exec`: **nenhum grant** na tabela;
- nenhuma view/RPC pública criada.

## Testes de identidade

Foi usada uma fixture sintética, sem PII, criada pelo `super_admin` apenas para provar isolamento por linha:

- `anon`: `SELECT` na tabela base recebe `permission denied`; drafts inacessíveis;
- `authenticated` sem perfil administrativo: vê `0` linhas e `INSERT` é rejeitado por RLS;
- `super_admin`: `SELECT`, `INSERT`, `UPDATE` e `DELETE` legítimos funcionam pela policy administrativa;
- a fixture foi removida ao final e a tabela voltou a `0` registros.

Também foi revalidado que não existe view, materialized view ou function/RPC baseada nessa tabela que permita contornar a RLS.

## Testes de aplicação

Validação isolada da Fase 2A no GitHub Actions, run `36039414015`:

- TypeScript: **PASS**;
- Vitest: **PASS — 69 testes**;
- build Vite: **PASS**;
- Playwright route smoke: **PASS**;
- viewports: `375x812` e `1280x900`;
- `/portal/implantacao/<token-inexistente>`: fallback seguro, sem draft e sem overflow horizontal;
- `/portal/proposta/<token-inexistente>`: fallback seguro e sem overflow;
- `/implantacao` em adapter local: renderização sem regressão e ação `Nova oportunidade` visível.

O smoke de browser usa deliberadamente o adapter local e não substitui a prova de segurança do banco. O caminho autenticado real foi comprovado diretamente no Lovable Cloud com a identidade `super_admin`.

## Lint

O workflow global continua falhando no lint histórico do repositório. O diff permanente da Fase 2A contém SQL e Markdown, sem arquivo JS/TS novo; portanto não existe lint ESLint direcionado significativo para o diff permanente. A dívida global não foi ampliada nem corrigida nesta fase.

## Rollback seguro

A tabela base **não deve voltar a ser pública**. Se uma funcionalidade futura precisar de conteúdo institucional publicado, o rollback funcional deve ser uma nova migration incremental criando uma projeção mínima `published-only`, sem `SELECT *`, sem `draft_*`, sem PII e sem notas internas.

## Pendências fora da Fase 2A

Continuam para fases próprias: proposta versionada/snapshot, reunião comercial, convite oficial da jornada, Owner Journey/RPCs ainda não materializadas, portal financeiro, Core e integrações.

A Fase 2A encerra somente o P0 de `portal_content_blocks` e não inicia a Fase 2B.
