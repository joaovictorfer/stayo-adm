# Migração do localStorage (Fase 13, estendida na Fase 16)

Mapa de toda chave `stayo-admin:*` usada hoje como armazenamento de
protótipo, o que ela guarda, e o que precisa acontecer para que o dado
sobreviva à chegada de um projeto Supabase real.

Nenhuma chave abaixo é lida/escrita fora do arquivo listado — a UI nunca
toca `localStorage` diretamente (ver `src/lib/api/local-store.ts` §topo).

## Já migradas (adapter Supabase existe e é escolhido automaticamente)

Estas sete chaves pertencem a verticais do `AdminApiClient`
(`src/lib/api/admin-client.ts`) que já têm `createLocalAdminApiClient()`
_e_ `createSupabaseAdminApiClient()` implementados lado a lado —
`createDefaultAdminApiClient()` troca de um para o outro sozinho quando
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` existem. Nenhuma tela muda.

| Chave localStorage                         | Tipo (`src/types/*.ts`)     | Tabela Supabase                | Migration                               |
| ------------------------------------------ | --------------------------- | ------------------------------ | --------------------------------------- |
| `stayo-admin:owner-records`                | `OwnerRecord`               | `owner_records`                | `0002_owner_records.sql`                |
| `stayo-admin:commercial-term-defaults`     | `CommercialTermDefault`     | `commercial_term_defaults`     | `0003_commercial_terms.sql`             |
| `stayo-admin:commercial-terms`             | `CommercialTerm`            | `commercial_terms`             | `0003_commercial_terms.sql`             |
| `stayo-admin:outbound-messages`            | `OutboundMessage`           | `outbound_messages`            | `0005_outbound_messages.sql`            |
| `stayo-admin:initial-charges`              | `InitialCharge`             | `initial_charges`              | `0006_initial_charges.sql`              |
| `stayo-admin:owner-onboarding-links`       | `OwnerOnboardingLink`       | `owner_portal_invitations`     | `0004_owner_portal_invitations.sql`     |
| `stayo-admin:owner-onboarding-submissions` | `OwnerOnboardingSubmission` | `owner_onboarding_submissions` | `0007_owner_onboarding_submissions.sql` |
| `stayo-admin:audit-logs`                   | `AuditLogEntry`             | `audit_logs`                   | `0001_admin_foundation.sql`             |

O importador (`src/lib/migration/local-to-supabase.ts`) migra as
**sete primeiras** para dentro do Supabase quando ele existir. `audit-logs`
fica de fora do importador de propósito — ver nota abaixo.

**Fase 16 — `ownerOnboardingStore` promovido.** Até a Fase 15,
`owner-onboarding-links`/`owner-onboarding-submissions` tinham schema pronto
mas o código (`ownerOnboardingStore` em `local-store.ts`) nunca ganhou um
branch Supabase — travado porque o portal público (convite/auto-cadastro)
é acessado por um visitante **anônimo**, sem sessão, e as RLS das duas
tabelas exigem papel do time interno. A Fase 16 resolveu isso: o caminho
público (`findByToken`/`submit`) agora passa por duas funções
`security definer` (`owner_onboarding_resolve_token`/`owner_onboarding_submit`,
migration `0007`) que revalidam tudo server-side (hash do token,
expiração/revogação/uso) sem nunca abrir a tabela para `anon` diretamente —
o caminho interno (`getLink`/`createLink`/`revoke`/`getSubmission`) continua
acesso direto sob RLS normal, como o resto do `AdminApiClient`. Ver
`docs/OWNER_ONBOARDING_ARCHITECTURE.md`.

**Nota sobre `audit-logs`:** a policy de `insert` de `audit_logs` exige
`actor_id = auth.uid()` (ver `0001_admin_foundation.sql`), e todo evento
registrado neste protótipo tem `actorId: null` (não existe usuário
autenticado ainda). Isso é intencional — a auditoria nunca deve aceitar um
`actor_id` arbitrário vindo do cliente — mas por isso **um dump client-side
com a chave anon nunca vai conseguir inserir esse histórico**. Migrar
`audit_logs` requer um script rodado com a `service_role` fora do browser
(nunca em código de frontend/bundle — ver `docs/SECURITY_AND_RLS.md`), o
que fica fora do escopo desta fase. O histórico de auditoria do protótipo
é tratado como descartável quando o Supabase entrar no ar; a auditoria real
recomeça do zero, o que é aceitável para um log de eventos (não é dado de
negócio).

## Schema e RLS prontos, adapter ainda local (Fase 17E/G)

Estas quatro chaves ganharam tabela + RLS real nesta fase (migrations
`0009`/`0010`, testadas contra o banco real — ver `docs/RLS_MATRIX.md`),
mas **o adapter/UI continua lendo do mock local** — trocar a leitura é
uma refatoração de superfície grande demais para empacotar junto com o
schema (toda tela de Implantação/Portal/Proposta/Dashboard/BI referencia
`implementationId`). Ver `docs/DATA_PERSISTENCE.md` para o estado exato,
tabela por tabela, e o que falta para trocar cada uma.

| Chave localStorage | Tipo | Onde vive hoje (leitura real hoje) | Tabela Supabase (schema já existe) | Migration |
| --- | --- | --- | --- | --- |
| `stayo-admin:implementations` | `ImplementationProject` | `CoreApiClient` mock (`core-client.ts`) | `implementation_projects` | `0009_implementation_projects.sql` |
| `stayo-admin:implementation-items` | `ImplementationItem` (checklist) | `CoreApiClient` mock (`core-client.ts`) | `implementation_items` | `0009_implementation_projects.sql` |
| `stayo-admin:proposals` | `Proposal` (versões) | `proposalsStore` (`local-store.ts`) | `proposals` | `0010_proposals.sql` |
| `stayo-admin:proposal-share-links` | `ProposalShareLink` | `proposalShareStore` (`local-store.ts`) | `proposal_share_links` | `0010_proposals.sql` |

## Sem schema Supabase ainda (dado de negócio real — precisa de migração futura)

| Chave localStorage                 | Tipo                                             | Onde vive hoje                               | Nota                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stayo-admin:owner-notes`          | Notas internas por proprietário                  | `ownerNotesStore` (`local-store.ts`)         | Anotação livre da Central do Proprietário; sem tabela ainda.                                                                                                                                                                                                                                                                     |
| `stayo-admin:checklist-templates`  | Templates de checklist de implantação            | `checklistTemplatesStore` (`local-store.ts`) | Configuração (não é dado transacional), mas ainda assim precisa sobreviver — sem tabela ainda.                                                                                                                                                                                                                                   |

## Nunca migra (dado fictício do mock do Core — descartado quando o Core real existir)

| Chave localStorage            | Tipo            | Motivo                                                                                                                                                     |
| ----------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stayo-admin:guide-entries`   | `GuideEntry`    | Conteúdo do Guia é hoje só mock do `CoreApiClient` (Grupo B) — quando o Core real existir, o conteúdo de verdade vem de lá, nunca de um dump do protótipo. |
| `stayo-admin:products`        | `UpsellProduct` | Idem — catálogo de produtos/serviços é dado do Core.                                                                                                       |
| `stayo-admin:inspections`     | `Inspection`    | Idem — vistorias são operação do Core (Grupo B).                                                                                                           |
| `stayo-admin:operation-tasks` | `OperationTask` | Idem — rotinas operacionais são do Core (Grupo B).                                                                                                         |

## O importador (`src/lib/migration/local-to-supabase.ts`)

- `collectLocalAdminSnapshot()` — função pura, lê as sete chaves "já
  migradas" (exceto `audit-logs`) via o mesmo `read()` de
  `local-store.ts`. Roda em qualquer ambiente (retorna listas vazias no
  servidor, onde não há `window`) e não depende do Supabase — por isso é
  testável com Vitest (`local-to-supabase.test.ts`).
- `importLocalAdminDataToSupabase()` — só executa se
  `isSupabaseConfigured()` for verdadeiro (nunca tenta conectar sem
  credencial). Faz `upsert` (nunca `insert` simples) com `onConflict: "id"`
  (ou `"implementation_id"` para `owner_onboarding_submissions`, que não
  tem `id` próprio no tipo local), preservando o UUID já gerado no
  protótipo — rodar duas vezes nunca duplica linha. Ordem: `owner_records`
  → `commercial_term_defaults` → `commercial_terms` → `outbound_messages`
  → `initial_charges` → `owner_portal_invitations` →
  `owner_onboarding_submissions` (nenhuma tem FK de banco entre si hoje —
  ver nota em `0003_commercial_terms.sql` — mas a ordem segue a
  dependência lógica).

## Validação contra um projeto Supabase real (Fase 16)

Todas as sete migrations (`0001`–`0007`) foram aplicadas e validadas
diretamente contra um projeto Supabase real (Lovable Cloud, conectado a
este repositório) — não é só leitura estática do SQL. Cobriu:

- Toda a matriz de RLS por papel: `anon` não lê nenhuma tabela de negócio;
  `viewer` lê mas não escreve `owner_records`; `commercial` escreve
  `owner_records` mas não `initial_charges`; `finance` escreve
  `initial_charges` mas não `commercial_term_defaults`; `operations` não
  gerencia condições comerciais.
- O fluxo público completo do convite/auto-cadastro via as funções
  `security definer`: `anon` não lê `owner_portal_invitations`
  diretamente, mas resolve um token e envia um cadastro via RPC; um
  segundo envio no mesmo token é rejeitado (`convite já usado`); convite
  revogado e convite expirado são rejeitados com a mensagem certa.

Um bug real de sintaxe foi encontrado e corrigido neste processo:
`pgcrypto` é instalado por padrão no schema `extensions` do Supabase, não
em `public` — as duas funções da migration `0007` precisavam de
`set search_path = public, extensions`, não só `public`, para `digest()`
resolver. Corrigido diretamente no arquivo da migration.

Todos os dados de teste usados nessa validação foram removidos depois —
o banco fica com o schema aplicado e vazio, pronto para dado real.

## Validação contra um projeto Supabase real (Fase 17E/G)

As migrations `0009_implementation_projects.sql` e `0010_proposals.sql`
também foram aplicadas e validadas diretamente contra o mesmo projeto
Supabase real — não é só leitura estática do SQL. Cobriu:

- RLS por papel em `implementation_projects`/`implementation_items`:
  `anon` não lê nenhuma das duas, `viewer` lê mas não escreve,
  `operations` escreve, `finance` não escreve (não gerencia
  implantações) — ver `docs/RLS_MATRIX.md`.
- O caminho público de `proposals`/`proposal_share_links` via as funções
  `security definer` (`proposal_resolve_by_token`/
  `proposal_accept_by_token`): `anon` não lê nenhuma das duas tabelas
  diretamente, resolve uma proposta por token e aceita via RPC; um
  segundo aceite com nome diferente é idempotente (não sobrescreve o
  aceite original — a versão aceita continua imutável).
- A constraint `unique (implementation_id, version)` de `proposals`:
  confirmada rejeitando um segundo `insert` da mesma versão — é isso que
  garante, no próprio banco (não só em memória do app), que duas criações
  simultâneas da mesma versão nunca colidem.

Um bug real foi encontrado e corrigido neste processo (não só na fase
anterior): a primeira versão de `proposal_accept_by_token` usava
`RETURNS TABLE (accepted_at timestamptz, ...)`, e dentro do corpo da
função o nome `accepted_at` virou uma variável implícita que colidia
("ambíguo", erro `42702`) com a coluna de mesmo nome em `proposals`
referenciada sem qualificador no `UPDATE`/`WHERE`. Corrigido qualificando
todas as referências com o alias da tabela (`pr.accepted_at`, `pr.id`)
dentro do corpo da função — ver comentário no próprio arquivo da
migration.

Todos os dados de teste (perfis, proprietário, implantação, proposta,
link) foram removidos depois — confirmado por contagem zerada em todas
as tabelas antes de seguir para a próxima fase.
