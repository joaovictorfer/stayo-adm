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
| Owner Auth (conta própria do proprietário)                      | ❌ não existe                                            | ❌ não existe (acesso só por link/token)                         | —                                       | `docs/AUTH_AND_ROLES.md` §"O que falta"                       |
| Owner Tasks ("Precisamos de você")                              | ❌ não existe (conceito novo, não construído nesta fase) | ❌ não existe                                                    | —                                       | ver nota "Owner Tasks" abaixo                                 |
| Anexos/documentos (attachments)                                 | ❌ não existe (conceito novo, não construído nesta fase) | ❌ não existe                                                    | —                                       | ver nota "Attachments" abaixo                                 |

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

## Nota sobre `audit_logs`

A policy de `insert` exige `actor_id = auth.uid()` — nunca aceita um
`actor_id` arbitrário vindo do cliente. Isso significa que, no protótipo
sem Supabase Auth configurado (`actorId: null` em todo evento local), a
auditoria nunca teria conseguido gravar no Supabase mesmo se tentasse.
Com a Fase 17B (Supabase Auth do time interno) isso já não é mais
teórico: qualquer usuário autenticado real grava `actor_id` de verdade.
Ver `docs/AUTH_AND_ROLES.md` para o estado da autenticação.

## Nota: Owner Tasks ("Precisamos de você")

O prompt mestre da Fase 17I pede um conceito novo — pendências do
proprietário (dado bancário faltando, Wi-Fi faltando, documento de
regularização faltando etc.) visíveis tanto para o admin quanto para o
proprietário. Isto **não foi construído nesta passada**: é um módulo de
negócio genuinamente novo (não uma extração de dado já existente do
mock), e a mesma Fase 17 também instrui explicitamente a não criar novos
módulos de negócio não planejados fora do que já está desenhado. Fica
registrado aqui como lacuna conhecida, não como "feito silenciosamente".

## Nota: Attachments (documentos/anexos)

Mesma situação do item acima — armazenamento privado de documentos
(Storage do Supabase, com metadata de mime/tamanho/categoria/autor) é
conceito novo, não uma tabela que já existisse em algum mock. Não
construído nesta passada, pela mesma razão.
