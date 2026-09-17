# Migração do localStorage (Fase 13)

Mapa de toda chave `stayo-admin:*` usada hoje como armazenamento de
protótipo, o que ela guarda, e o que precisa acontecer para que o dado
sobreviva à chegada de um projeto Supabase real.

Nenhuma chave abaixo é lida/escrita fora do arquivo listado — a UI nunca
toca `localStorage` diretamente (ver `src/lib/api/local-store.ts` §topo).

## Já migradas (adapter Supabase existe e é escolhido automaticamente)

Estas seis chaves pertencem a verticais do `AdminApiClient`
(`src/lib/api/admin-client.ts`) que já têm `createLocalAdminApiClient()`
_e_ `createSupabaseAdminApiClient()` implementados lado a lado —
`createDefaultAdminApiClient()` troca de um para o outro sozinho quando
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` existem. Nenhuma tela muda.

| Chave localStorage                     | Tipo (`src/types/*.ts`) | Tabela Supabase            | Migration                    |
| -------------------------------------- | ----------------------- | -------------------------- | ---------------------------- |
| `stayo-admin:owner-records`            | `OwnerRecord`           | `owner_records`            | `0002_owner_records.sql`     |
| `stayo-admin:commercial-term-defaults` | `CommercialTermDefault` | `commercial_term_defaults` | `0003_commercial_terms.sql`  |
| `stayo-admin:commercial-terms`         | `CommercialTerm`        | `commercial_terms`         | `0003_commercial_terms.sql`  |
| `stayo-admin:outbound-messages`        | `OutboundMessage`       | `outbound_messages`        | `0005_outbound_messages.sql` |
| `stayo-admin:initial-charges`          | `InitialCharge`         | `initial_charges`          | `0006_initial_charges.sql`   |
| `stayo-admin:audit-logs`               | `AuditLogEntry`         | `audit_logs`               | `0001_admin_foundation.sql`  |

O importador (`src/lib/migration/local-to-supabase.ts`) migra as
**cinco primeiras** para dentro do Supabase quando ele existir. `audit-logs`
fica de fora do importador de propósito — ver nota abaixo.

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

## Schema pronto, adapter ainda local (gap real, documentado)

| Chave localStorage                         | Tipo                        | Tabela Supabase                                                  | Situação                                                                                                                                                                                          |
| ------------------------------------------ | --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stayo-admin:owner-onboarding-links`       | `OwnerOnboardingLink`       | `owner_portal_invitations` (`0004_owner_portal_invitations.sql`) | Schema existe desde a Fase 8, mas `ownerOnboardingStore` (`src/lib/api/local-store.ts`) nunca ganhou um branch Supabase — continua sempre local, mesmo quando `VITE_SUPABASE_*` está configurado. |
| `stayo-admin:owner-onboarding-submissions` | `OwnerOnboardingSubmission` | Nenhuma tabela própria ainda                                     | Os dados que o proprietário envia no auto-cadastro (nome, documento, Pix) não têm uma tabela Supabase dedicada — precisa nascer junto quando `ownerOnboardingStore` for promovido.                |

Importar estas duas chaves antes de promover `ownerOnboardingStore` ao
padrão `AdminApiClient` (local + Supabase lado a lado) não teria efeito
prático: a tela continuaria lendo do localStorage de qualquer forma. Este é
o próximo item preparatório real antes de estender o importador — deixado
como próxima fase, não como parte do importador atual.

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

- `collectLocalAdminSnapshot()` — função pura, lê as cinco chaves "já
  migradas" (exceto `audit-logs`) via o mesmo `read()` de
  `local-store.ts`. Roda em qualquer ambiente (retorna listas vazias no
  servidor, onde não há `window`) e não depende do Supabase — por isso é
  testável com Vitest (`local-to-supabase.test.ts`).
- `importLocalAdminDataToSupabase()` — só executa se
  `isSupabaseConfigured()` for verdadeiro (nunca tenta conectar sem
  credencial). Faz `upsert` (nunca `insert` simples) com `onConflict:
"id"`, preservando o UUID já gerado no protótipo — rodar duas vezes
  nunca duplica linha. Ordem: `owner_records` → `commercial_term_defaults`
  → `commercial_terms` → `outbound_messages` → `initial_charges` (nenhuma
  tem FK de banco entre si hoje — ver nota em `0003_commercial_terms.sql`
  — mas a ordem segue a dependência lógica).
- Bloqueado por credencial externa que não existe neste ambiente (nenhum
  projeto Supabase real): não há como testar o `upsert` de ponta a ponta
  aqui. O gap fica documentado, não bloqueia o resto do projeto — exatamente
  a regra da Fase 0 do plano mestre.
