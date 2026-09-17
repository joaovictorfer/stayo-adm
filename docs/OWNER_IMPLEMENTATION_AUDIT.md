# Auditoria — Central Comercial e de Onboarding do Proprietário

> Fase 0 do plano de evolução da Implantação/Portal do Proprietário.
> Gerado por auditoria automatizada do estado real do repositório em
> setembro/2026, antes de qualquer alteração.

## 1. Como o projeto está hospedado

- Repositório: `github.com/joaovictorfer/stayo-adm`.
- Stack: TanStack Start (SSR) + Nitro (target Cloudflare) + TanStack Router +
  React 19 + TanStack Query v5 + Tailwind v4. Template Lovable
  (`@lovable.dev/vite-tanstack-config`, `.lovable/project.json`), mas **sem**
  projeto Lovable vinculado (`project.json` só tem metadata de template, sem
  `projectId`) — os conectores Lovable/Supabase do MCP não se aplicam a este
  repo.
- **Não existe banco de dados.** Nenhum diretório `supabase/`, nenhum
  `.env`, nenhuma dependência `@supabase/*` no `package.json`.
- **Não existe autenticação.** Nenhuma rota de login, nenhum conceito de
  sessão/usuário/role no código.
- Toda persistência hoje é `localStorage` no navegador (`src/lib/api/local-store.ts`)
  ou dados mockados em memória (`src/lib/api/core-client.ts`).

Classificação: **INVESTIGAR → CREDENCIAL EXTERNA INEXISTENTE.** Construir
Postgres/Supabase real requer um projeto Supabase (URL + chaves) que não
existe neste ambiente. Isso é reportado como blocker específico (não do
projeto inteiro) nas seções seguintes — a Fase 1 constrói o contrato e os
adapters para que a troca seja só de configuração quando a credencial existir.

## 2. Domínio já implementado (Grupo A — próprio do Admin)

Todos hoje vivem em `localStorage`, sem RLS, sem multiusuário real:

| Entidade | Onde | Status |
|---|---|---|
| `ImplementationProject` (implantação) | `core-client.ts` mock, chave `stayo-admin:implementations` | CRUD real (browser-local) |
| `ImplementationItem` (checklist) | `stayo-admin:implementation-items` | CRUD real, gerado a partir de template |
| `ChecklistTemplateItem` | `local-store.ts`, `stayo-admin:checklist-templates` | CRUD real |
| `Proposal`/`ProposalItem` | `stayo-admin:proposals` | Versionado (campo `version`), sem hash de snapshot |
| `ProposalShareLink` | `stayo-admin:proposal-share-links` | 1 link por implantação — **aponta para a implantação, não para a versão** (bug, ver §4) |
| `OwnerOnboardingLink`/`Submission` | `stayo-admin:owner-onboarding-links/submissions` | Auto-cadastro sem autenticação real, token só evita adivinhação |
| `OwnerNote` | `stayo-admin:owner-notes` | Notas internas simples |
| `OperationTask`, `Inspection` | mock `core-client.ts` | CRUD real, status como texto livre |
| `GuideEntry`, `UpsellProduct` | `local-store.ts` | CRUD real |

`ImplementationProject.ownerProspect` é um objeto embutido (`{name, phone, email}`)
— **não existe uma entidade `Owner`/`owner_records` separada no domínio Admin**.
O tipo `Owner` existente em `core.ts` é do domínio Core (mock sempre vazio,
somente leitura) e não tem nenhuma relação com `ownerProspect`. Isso é a
lacuna estrutural central que a Fase 2 do plano master resolve.

## 3. Domínio do Core (Grupo B — somente leitura, mock vazio)

`Property`, `Condominium`, `Reservation`, `Guest`, `Owner`, `Contract`,
`Payout`, `ServiceInvoice`, `ServiceProvider`, `Settlement`, `Expense`,
`Conversation` — todos com `list()/get()` implementados, sempre retornando
vazio no mock, e `fetch()` real contra `VITE_CORE_API_URL` quando configurado
(nunca configurado hoje). Nenhuma escrita simulada nestes — correto e para
manter.

## 4. Divergências encontradas vs. o comportamento correto exigido

1. **Link de proposta aponta para a implantação, não para a versão**
   (`portal.proposta.$token.tsx` usa `proposalsByImplementationQuery` e pega
   `data?.[0]`, i.e. sempre a versão mais recente). Um link enviado para v1
   passa a mostrar v2 se uma nova versão for criada. Precisa apontar para
   `proposalVersionId`.
2. **Sem snapshot/hash da versão aceita.** `Proposal.acceptedAt` existe, mas
   não há `snapshot_hash`, `accepted_name`, `accepted_document`, IP,
   user-agent.
3. **Sem separação Progresso × Prontidão.** `ImplementationItem.status` tem
   `pulado`/`nao_aplicavel`, mas nada hoje trata `blocker: true` + `pulado`
   como bloqueio residual — é preciso um `readiness_override` explícito.
4. **Sem `validateOperationalReadiness()`.** A transição de status do funil
   (`implantacao.$id.tsx`, `StatusStepper`) é livre; nada impede ativar com
   bloqueadores obrigatórios pendentes.
5. **Convite do portal não expira, não é revogável, não tem hash.** O token
   de `OwnerOnboardingLink`/`ProposalShareLink` é um UUID salvo em texto puro
   sem `expires_at`/`revoked_at`/`used_at`.
6. **Sem PDF real.** Não há gerador de PDF em lugar nenhum do projeto.
7. **Sem WhatsApp.** Não há gateway, outbox, nem template de mensagem.
8. **Sem cobrança inicial.** Nenhuma entidade de cobrança existe.
9. **Sem auditoria.** Nenhum `audit_logs` ou equivalente.
10. **Sem perfis/roles/RLS.** Não há conceito de usuário autenticado no
    Admin em nenhuma camada.
11. **Config comercial hardcoded no componente, não em `Configurações`.**
    Taxas/valores default não existem como entidade configurável.
12. **`CoreApiClient` acopla domínio Admin e domínio Core no mesmo
    contrato** (`implementations`, `guide`, `products` misturados com
    `properties`, `reservations` etc.) — tecnicamente funciona, mas viola a
    separação conceitual Grupo A / Grupo B que o plano master pede. Fase 1
    separa isso em `AdminApiClient` próprio.

## 5. Classificação por arquivo (resumo)

- **MANTER como está:** design system (`--stayo-*` tokens), `AdminShell`,
  `navigation.ts`, `Drawer`/`Wizard`/`Timeline`/`IndicatorCard`/`LinkedField`/
  `StatusField`, estrutura de rotas TanStack, `core.ts` (domínio Core),
  padrão mock-vs-real do `CoreApiClient` para o domínio Core.
- **REFATORAR:** `core-client.ts` (separar Admin do Core), `local-store.ts`
  (vira adapter substituível por Supabase), `ProposalTab.tsx` e
  `portal.proposta.$token.tsx` (versionamento por link), `implantacao.$id.tsx`
  (adicionar prontidão/bloqueio), `ImplementationProject.ownerProspect`
  (extrair para `owner_records` real).
- **MIGRAR (quando Supabase existir):** todas as chaves `stayo-admin:*` do
  `localStorage` — inventariadas na tabela da §2.
  **CI**, testes já cobrem lógica pura (`format.ts`, `contract-status.ts`,
  `implementation-status.ts`) — manter e estender.
- **INVESTIGAR/BLOQUEADO por credencial externa:** Supabase (banco + auth),
  gateway de WhatsApp real, geração fiscal, provider de assinatura
  eletrônica. Tratados como adapters com feature flag OFF + mock seguro
  (ver `docs/CORE_CONVERSION.md`, `docs/WHATSAPP_OUTBOX.md` quando
  publicados nas fases correspondentes).

## 6. Decisão adotada para a Fase 1 em diante

Sem uma credencial de Supabase real disponível neste ambiente, a Fase 1
constrói:
- o **schema alvo completo** (migrations SQL versionadas em
  `supabase/migrations/`) pronto para rodar assim que houver projeto;
- um **`AdminApiClient`** (contrato TypeScript, análogo ao `CoreApiClient`)
  com duas implementações: `createSupabaseAdminApiClient()` (real, atrás de
  `@supabase/supabase-js`) e `createLocalAdminApiClient()` (fallback atual,
  baseado em `local-store.ts`), selecionadas automaticamente por variável de
  ambiente — nenhuma tela decide isso.
- Isso não bloqueia nenhuma fase seguinte: todo o restante do plano
  (proprietário, pré-imóvel, timeline, propostas, portal, PDF, WhatsApp,
  cobrança) é implementado contra o `AdminApiClient`, funcionando hoje sobre
  o adapter local e pronto para virar persistência real com zero mudança de
  UI, exatamente como já acontece com `CoreApiClient`.
