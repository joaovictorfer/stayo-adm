# Persistência de dados — estado real, domínio por domínio (Fase 17)

Este documento é a fonte única de verdade sobre **onde cada domínio do
Grupo A vive de verdade hoje**: schema no Supabase, RLS testada, e se o
adapter (`AdminApiClient`/UI) já lê de lá ou ainda do mock local. Não
confundir "schema existe" com "está em produção" — as duas colunas
`Schema+RLS` e `Adapter` abaixo são propositalmente separadas.

| Domínio                                                         | Schema+RLS                                               | Adapter (local vs Supabase)                                      | Migration                               | Onde ver a validação                                          |
| --------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| Proprietário (`OwnerRecord`)                                    | ✅ real, testado                                         | ✅ Supabase quando configurado                                   | `0002_owner_records.sql`                | `docs/RLS_MATRIX.md`                                          |
| Condições comerciais (`CommercialTermDefault`/`CommercialTerm`) | ✅ real, testado                                         | ✅ Supabase quando configurado                                   | `0003_commercial_terms.sql`             | `docs/RLS_MATRIX.md`                                          |
| Convite de auto-cadastro (`OwnerOnboardingLink`)                | ✅ real, testado                                         | ✅ Supabase quando configurado (via RPC pública)                 | `0004`/`0007`                           | `docs/RLS_MATRIX.md`, `docs/OWNER_ONBOARDING_ARCHITECTURE.md` |
| Envio de auto-cadastro (`OwnerOnboardingSubmission`)            | ✅ real, testado                                         | ✅ Supabase quando configurado (via RPC pública)                 | `0007_owner_onboarding_submissions.sql` | idem                                                          |
| WhatsApp outbox (`OutboundMessage`)                             | ✅ real, testado                                         | ✅ Supabase quando configurado                                   | `0005_outbound_messages.sql`            | `docs/LOCALSTORAGE_MIGRATION.md`                              |
| Cobrança inicial (`InitialCharge`)                              | ✅ real, testado                                         | ✅ Supabase quando configurado                                   | `0006_initial_charges.sql`              | `docs/LOCALSTORAGE_MIGRATION.md`                              |
| Auditoria (`AuditLogEntry`)                                     | ✅ real (RLS exige `actor_id = auth.uid()`)              | ⚠️ só grava quando há usuário autenticado real — ver nota abaixo | `0001_admin_foundation.sql`             | `docs/AUTH_AND_ROLES.md`                                      |
| Time interno (`AdminProfile`)                                   | ✅ real, testado (inclui bootstrap do 1º super_admin)    | ✅ via Supabase Auth (`src/lib/auth/session.ts`)                 | `0001`/`0008`                           | `docs/AUTH_AND_ROLES.md`, `docs/RLS_MATRIX.md`                |
| Pré-imóvel/Implantação (`ImplementationProject`)                | ✅ real, testado (Fase 17E)                              | ❌ ainda lê do mock `CoreApiClient` (`core-client.ts`)           | `0009_implementation_projects.sql`      | `docs/RLS_MATRIX.md`, `docs/LOCALSTORAGE_MIGRATION.md`        |
| Checklist de implantação (`ImplementationItem`)                 | ✅ real, testado (Fase 17E)                              | ❌ ainda lê do mock `CoreApiClient`                              | `0009_implementation_projects.sql`      | idem                                                          |
| Proposta versionada (`Proposal`)                                | ✅ real, testado (Fase 17G)                              | ❌ ainda lê de `proposalsStore` (`local-store.ts`)               | `0010_proposals.sql`                    | idem                                                          |
| Link público da proposta (`ProposalShareLink`)                  | ✅ real, testado (Fase 17G)                              | ❌ ainda lê de `proposalShareStore`                              | `0010_proposals.sql`                    | idem                                                          |
| Templates de checklist (`ChecklistTemplateItem`)                | ✅ real, testado (Fase 17F)                              | ❌ ainda lê de `checklistTemplatesStore` (`local-store.ts`)      | `0011_checklist_templates.sql`          | `docs/RLS_MATRIX.md`                                          |
| Notas do proprietário (`ownerNotesStore`)                       | ✅ real, testado (Fase 17F)                              | ❌ ainda lê de `ownerNotesStore` (`local-store.ts`)              | `0012_owner_notes.sql`                  | idem                                                          |
| Owner Auth (`owner_portal_accounts`)                            | ✅ real, testado (Fase 17H)                              | ✅ Supabase quando configurado (`owner-session.ts`, RPC)         | `0013_owner_auth.sql`                   | `docs/RLS_MATRIX.md`, `docs/AUTH_AND_ROLES.md`                |
| Owner Tasks ("Precisamos de você", `owner_tasks`)               | ✅ real, testado (Fase 17I)                              | ✅ Supabase quando configurado (admin cria/gerencia, proprietário só lê) | `0014_owner_tasks.sql`           | `docs/RLS_MATRIX.md`                                          |
| Anexos/documentos (`attachments`, Storage privado)              | ✅ real, testado (Fase 17I)                              | ✅ só Supabase (sem equivalente local — ver nota "Attachments")  | `0015_attachments.sql`                  | `docs/RLS_MATRIX.md`, ver nota "Attachments" abaixo           |

## Por que `implementation_projects`/`proposals` têm schema mas não adapter

A extração de `ImplementationProject`/`ImplementationItem` do mock do
`CoreApiClient`, e de `Proposal`/`ProposalShareLink` de `local-store.ts`,
para leitura real do Supabase é uma refatoração de **superfície muito
maior** que qualquer vertical migrada até aqui: toda tela de Implantação
(`implantacao.tsx`, `implantacao.$id.tsx`), as duas páginas de portal
público (`portal.implantacao.$token.tsx`, `portal.proposta.$token.tsx`),
`core-conversion.ts` (Fase 11), Dashboard e BI leem `implementationId`
direta ou indiretamente. Trocar isso com o mesmo rigor de validação
fase-a-fase do resto do plano (não uma troca apressada dentro da mesma
migration) é trabalho para uma fase dedicada subsequente — o schema e a
RLS já existem e já foram testados de ponta a ponta contra o banco real,
então essa fase futura só precisa trocar a camada de leitura/escrita, não
desenhar nada novo.

## Concorrência/idempotência de cobrança inicial (Fase 17J)

Auditoria do fluxo de `initialCharges.createFromProposal` (o que roda
quando o proprietário aceita a proposta no portal) contra o requisito
mais rígido do prompt mestre: "duplo aceite nunca duplica cobrança, sem
duplicação por retry". A constraint `unique (proposal_id)` da migration
`0006` já garantia a integridade dos dados (nunca duas linhas para a
mesma proposta), mas o adapter Supabase (`src/lib/api/admin-client.ts`)
fazia um `select` de existência seguido de `insert` — uma corrida real
entre dois `insert`s simultâneos (duplo clique, duas abas) não era
resolvida pela checagem em memória, só pela constraint do banco, e o
código não tratava esse erro: quem perdesse a corrida via um erro cru de
`unique_violation` na tela em vez de uma resposta idempotente.

Corrigido: o `insert` agora captura `23505` (`isUniqueViolation`,
`src/lib/sequential-code.ts`) e distingue qual constraint foi violada
(`constraintTargetsColumn`, por texto da mensagem do Postgres — validado
contra o erro real do banco, ver abaixo). Colisão em `proposal_id`
(a mesma proposta sendo aceita duas vezes ao mesmo tempo) busca e devolve
o registro que a outra chamada já criou, sem erro. Colisão só em `code`
(duas gerações concorrentes calcularam o mesmo próximo número
sequencial — `nextSequentialCode` nunca foi concorrência-segura sozinho)
tenta de novo com a lista atualizada, até 5 vezes.

Validado contra o Supabase real: reproduzido um `insert` duplicado por
`proposal_id` (erro observado: `duplicate key value violates unique
constraint "initial_charges_proposal_id_key"`) e um duplicado por `code`
(`"initial_charges_code_key"`) — confirmando que os nomes de constraint
gerados automaticamente pelo Postgres batem exatamente com o que
`constraintTargetsColumn` procura. Testes unitários em
`src/lib/sequential-code.test.ts` cobrem os dois helpers isoladamente.

**Pendência conhecida:** a mesma corrida existe, em teoria, para a
geração de código `IMP-xxxxx` (`src/lib/implementation-status.ts`), mas
hoje isso só roda contra o mock local do `CoreApiClient` (sem adapter
Supabase ainda — ver "Schema e RLS prontos, adapter ainda local" acima),
onde não há concorrência real (JS de aba única). Quando
`implementation_projects` ganhar seu adapter Supabase, aplicar o mesmo
padrão de captura de `23505` usado aqui.

## Nota sobre `audit_logs`

A policy de `insert` exige `actor_id = auth.uid()` — nunca aceita um
`actor_id` arbitrário vindo do cliente. Isso significa que, no protótipo
sem Supabase Auth configurado (`actorId: null` em todo evento local), a
auditoria nunca teria conseguido gravar no Supabase mesmo se tentasse.
Com a Fase 17B (Supabase Auth do time interno) isso já não é mais
teórico: qualquer usuário autenticado real grava `actor_id` de verdade.
Ver `docs/AUTH_AND_ROLES.md` para o estado da autenticação.

## Owner Tasks ("Precisamos de você", Fase 17I)

Construído: tabela `owner_tasks` (migration `0014`), RLS (time interno
gerencia; proprietário só lê a própria pendência, via a mesma
`owner_portal_accounts` da Fase 17H — nenhuma tabela nova de vínculo),
adapter completo (local + Supabase) e UI dos dois lados: o admin cria e
marca como resolvida em `/proprietarios/$id` (painel "Precisamos de
você"), o proprietário vê a lista de pendências em `/portal/inicio`
depois de entrar em `/portal/login`. Deliberadamente sem escrita do
proprietário — resolver uma pendência é sempre o time interno
confirmando que o dado chegou de verdade, nunca um `update` direto do
proprietário sob a própria sessão (a RLS nem tem policy de escrita para
ele). Validado contra o banco real: isolamento entre dois proprietários
diferentes, `anon`/`viewer` sem escrita, `update` do proprietário
afetando zero linhas silenciosamente (mesmo padrão de `owner_notes`).

## Attachments (documentos/anexos, Fase 17I)

Construído: bucket privado `owner-attachments` (nunca público — criado
via `insert` direto em `storage.buckets`, que é exatamente o que a API
de Storage faz por baixo), tabela `attachments` com metadata
(mime/tamanho/categoria/autor/nome), RLS na tabela E em
`storage.objects` (o que o próprio serviço de Storage consulta a cada
upload/download, não só um `select` cru na tabela) — proprietário só
lê/envia dentro da própria pasta (`<owner_id>/...`), nunca a de outro;
time interno acessa tudo. Cliente: `src/lib/api/attachments.ts`
(upload/listagem/URL assinada temporária/remoção — nunca um caminho
servido publicamente), com UI dos dois lados: admin faz upload/baixa/
remove em `/proprietarios/$id` ("Anexos"), proprietário só baixa em
`/portal/inicio` ("Seus documentos").

Diferente do resto do domínio: **não existe adapter local** para isto —
guardar um arquivo binário de verdade em `localStorage` não é uma opção
real (limite de tamanho, sem persistência de binário entre sessões), só
faz sentido com o Storage do Supabase. Sem credencial configurada, a UI
mostra "não disponível" (mesmo padrão das telas de auth), nunca finge
funcionar.

Achado real testando contra o banco: `storage.objects` tem um gatilho
(`storage.protect_delete()`) que bloqueia `delete` direto via SQL cru por
padrão — só a API de Storage (ou `set local
storage.allow_delete_query = 'true'`, usado só para limpar dado de teste
aqui) consegue apagar um objeto. Isso é uma proteção real do próprio
Supabase contra arquivo órfão, e o cliente (`deleteOwnerAttachment`) já
usa a API de Storage certa (`storage.from(bucket).remove(...)`), nunca um
`delete` cru.

Validado contra o Supabase real: `anon` não lê nada no bucket; um
proprietário insere só na própria pasta (inserir na pasta de outro é
rejeitado pela RLS); um segundo proprietário não vê o objeto do primeiro;
o time interno vê tudo; mesmo isolamento replicado na tabela `attachments`
(metadata). Dados de teste removidos depois.

**O que não foi validado**: upload/download de verdade via HTTP (a API de
Storage do supabase-js) — bloqueado pela mesma credencial externa do
resto do domínio (sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` neste
ambiente). O código do cliente segue a API documentada do supabase-js
exatamente como o resto deste adapter, mas não foi exercitado ponta a
ponta com um upload real de arquivo.
