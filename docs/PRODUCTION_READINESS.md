# Prontidão de produção — checklist

Ver `docs/STAYO_ADMIN_PRODUCTION_REPORT.md` para o relatório completo com
as 21 perguntas do prompt mestre respondidas uma a uma. Este documento é
o checklist resumido.

## Pronto (schema + RLS + adapter + validado contra o Supabase real)

- [x] `owner_records` — Proprietário
- [x] `commercial_term_defaults`/`commercial_terms` — Condições comerciais
- [x] `owner_portal_invitations`/`owner_onboarding_submissions` — Convite/auto-cadastro
- [x] `outbound_messages` — Outbox do WhatsApp (mock de envio, nunca real)
- [x] `initial_charges` — Cobrança inicial, **idempotente sob concorrência real** (Fase 17J)
- [x] `admin_profiles` — Time interno, com bootstrap seguro do 1º `super_admin`
- [x] Autenticação real do time interno (Supabase Auth) — login/logout/sessão/gate de rota
- [x] Matriz de RLS testada por papel (`docs/RLS_MATRIX.md`)
- [x] Importador do localStorage completo: detect→preview→import→validate→mark-migrated→report
- [x] `owner_portal_accounts` — Owner Auth (conta própria do proprietário, RLS de leitura própria em 4 tabelas — Fase 17H)
- [x] Suíte E2E real (Playwright, `e2e/`) — imutabilidade de versão de proposta, ciclo de vida do convite (inexistente/expirado/revogado/usado/válido), ausência de segredo no bundle de produção (`bun run test:e2e`, agora também no CI)

## Schema + RLS prontos, adapter ainda local (decisão deliberada, não esquecimento)

- [ ] `implementation_projects`/`implementation_items` — schema/RLS ok (0009), UI ainda lê do mock `CoreApiClient`
- [ ] `proposals`/`proposal_share_links` — schema/RLS ok (0010), UI ainda lê de `local-store.ts`
- [ ] `checklist_templates` — schema/RLS ok (0011), UI ainda lê de `local-store.ts`
- [ ] `owner_notes` — schema/RLS ok (0012), UI ainda lê de `local-store.ts`

Motivo do adiamento e o que falta exatamente: `docs/DATA_PERSISTENCE.md`.

## Não construído (gap conhecido e documentado, não escondido)

- [ ] Owner Tasks ("Precisamos de você") — conceito novo, não construído (`docs/DATA_PERSISTENCE.md` nota)
- [ ] Attachments/upload de documentos — conceito novo, não construído (idem)
- [ ] Fase 18 — o cenário completo de 30 passos admin↔owner com dois `browser.newContext()` de verdade contra o MESMO Supabase real, e os testes de concorrência com duas conexões paralelas de verdade — bloqueados pela mesma credencial externa (ver `e2e/README.md`; a parte que não depende dela — imutabilidade de versão, ciclo de vida do convite, secrets-in-bundle — já está commitada e roda no CI)
- [ ] Validação HTTP real de `signInWithPassword`/`signUp` (time interno E proprietário) contra o Supabase — bloqueada por credencial externa

## Bloqueios externos (não inventados, não contornados)

- `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` deste ambiente de deploy — ver `docs/SUPABASE_PRODUCTION_SETUP.md`.

## CI

Último estado conhecido: verde (branch `claude/analysis-8sf0c0`, checks
concluídos sem falha nas notificações mais recentes de PR). Cada commit
deste branch passou localmente por `tsc --noEmit`, `vitest run`, `eslint`
(0 erros, 10 warnings pré-existentes) e `vite build` antes de ser
empurrado.
