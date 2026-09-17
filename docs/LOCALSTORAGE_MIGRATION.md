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

## Sem schema Supabase ainda (dado de negócio real — precisa de migração futura)

| Chave localStorage                 | Tipo                                             | Onde vive hoje                               | Nota                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stayo-admin:proposals`            | `Proposal` (versões)                             | `proposalsStore` (`local-store.ts`)          | Nenhuma migration criada; é dado real (propostas comerciais versionadas, aceite do proprietário) — precisa de tabela própria com FK lógica para `implementation_id` no mesmo padrão de `commercial_terms`.                                                                                                                       |
| `stayo-admin:proposal-share-links` | `ProposalShareLink`                              | `proposalShareStore` (`local-store.ts`)      | Idem — o link público por versão de proposta também não tem tabela ainda.                                                                                                                                                                                                                                                        |
| `stayo-admin:owner-notes`          | Notas internas por proprietário                  | `ownerNotesStore` (`local-store.ts`)         | Anotação livre da Central do Proprietário; sem tabela ainda.                                                                                                                                                                                                                                                                     |
| `stayo-admin:checklist-templates`  | Templates de checklist de implantação            | `checklistTemplatesStore` (`local-store.ts`) | Configuração (não é dado transacional), mas ainda assim precisa sobreviver — sem tabela ainda.                                                                                                                                                                                                                                   |
| `stayo-admin:implementations`      | `ImplementationProject`                          | `CoreApiClient` mock (`core-client.ts`)      | Decisão registrada em `docs/OWNER_IMPLEMENTATION_ARCHITECTURE.md` §5/§6: fica no mock do Core por ora, mas é dado real de pré-imóvel/implantação digitado pelo time — precisa de tabela própria (`implementation_projects`) quando for extraído do mock, com as demais tabelas acima passando a referenciá-lo por FK de verdade. |
| `stayo-admin:implementation-items` | `ImplementationItem` (checklist por implantação) | `CoreApiClient` mock (`core-client.ts`)      | Mesma situação do item acima — inclui os campos de override de prontidão (Fase 5), que são dado de auditoria operacional real.                                                                                                                                                                                                   |

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
