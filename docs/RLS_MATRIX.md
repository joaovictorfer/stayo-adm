# Matriz de RLS — testada contra um banco real (Fases 16–17)

Todas as linhas abaixo foram **executadas de verdade**, não só lidas do
SQL — contra um projeto Supabase real (Lovable Cloud, conectado a este
repositório: `joaovictorfer/stayo-adm`), simulando cada papel via
`set local role authenticated; set local request.jwt.claims to
'{"sub":"<uuid>","role":"authenticated"}'` (o mesmo truque que o
PostgREST do Supabase usa por baixo para popular `auth.uid()`), e `set
local role anon` para o visitante público. Dados de teste sempre
removidos depois — o banco fica limpo, só com o schema aplicado.

## Papéis do time interno (`owner_records`, `commercial_term_defaults`, `initial_charges`)

| Ação                                   | Papel               | Esperado                                              | Resultado                                             |
| -------------------------------------- | ------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `select * from owner_records`          | `anon` (sem sessão) | 0 linhas                                              | ✅ `anon_can_see: 0`                                  |
| `select * from owner_records`          | `viewer`            | lê normalmente                                        | ✅ `viewer_can_read: 1`                               |
| `insert into owner_records`            | `viewer`            | rejeitado                                             | ✅ `42501 new row violates row-level security policy` |
| `insert into owner_records`            | `commercial`        | aceito                                                | ✅ linha criada                                       |
| `insert into commercial_term_defaults` | `operations`        | rejeitado (só super_admin/admin/commercial gerenciam) | ✅ `42501`                                            |
| `insert into initial_charges`          | `commercial`        | rejeitado (só super_admin/admin/finance gerenciam)    | ✅ `42501`                                            |
| `insert into initial_charges`          | `finance`           | aceito                                                | ✅ linha criada                                       |

## Caminho público do convite/auto-cadastro (`owner_portal_invitations`, `owner_onboarding_submissions`, Fase 16)

| Ação                                           | Papel            | Esperado                                                                            | Resultado                |
| ---------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------- | ------------------------ |
| `select * from owner_portal_invitations`       | `anon`           | 0 linhas (RLS bloqueia leitura direta)                                              | ✅ `anon_direct_read: 0` |
| `owner_onboarding_resolve_token(token válido)` | `anon` (via RPC) | resolve `implementation_id`/`expires_at`/`used_at`/`revoked_at`, nunca `token_hash` | ✅                       |
| `owner_onboarding_submit(token válido, ...)`   | `anon` (via RPC) | grava o envio, marca convite como usado                                             | ✅                       |
| `owner_onboarding_submit(mesmo token de novo)` | `anon`           | rejeitado — `convite já usado`                                                      | ✅                       |
| `owner_onboarding_submit(token revogado)`      | `anon`           | rejeitado — `convite revogado`                                                      | ✅                       |
| `owner_onboarding_submit(token expirado)`      | `anon`           | rejeitado — `convite expirado`                                                      | ✅                       |

## Bootstrap do primeiro administrador (`admin_profiles`, Fase 17, migration 0008)

| Ação                                             | Papel                                              | Esperado  | Resultado                                                                                         |
| ------------------------------------------------ | -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `insert into admin_profiles (role: super_admin)` | 1º usuário autenticado, tabela vazia               | aceito    | ✅ linha criada                                                                                   |
| `insert into admin_profiles (role: super_admin)` | 2º usuário autenticado, tabela já com 1 linha      | rejeitado | ✅ `42501` (depois de corrigir o bug do `exists` filtrado por RLS — ver `docs/AUTH_AND_ROLES.md`) |
| `insert into admin_profiles (role: commercial)`  | `super_admin` já existente convidando o 2º usuário | aceito    | ✅ linha criada                                                                                   |

## Implantações e checklist (`implementation_projects`, `implementation_items`, migration 0009)

| Ação                                    | Papel        | Esperado                              | Resultado               |
| --------------------------------------- | ------------ | ------------------------------------- | ----------------------- |
| `select * from implementation_projects` | `anon`       | 0 linhas                              | ✅ `anon_can_see: 0`    |
| `select * from implementation_items`    | `anon`       | 0 linhas                              | ✅ `anon_can_see: 0`    |
| `insert into implementation_projects`   | `operations` | aceito                                | ✅ linha criada         |
| `select * from implementation_projects` | `viewer`     | lê normalmente                        | ✅ `viewer_can_read: 1` |
| `insert into implementation_projects`   | `viewer`     | rejeitado                             | ✅ `42501`              |
| `insert into implementation_projects`   | `finance`    | rejeitado (não gerencia implantações) | ✅ `42501`              |
| `insert into implementation_items`      | `operations` | aceito                                | ✅ linha criada         |
| `insert into implementation_items`      | `viewer`     | rejeitado                             | ✅ `42501`              |

## Propostas e link público por versão (`proposals`, `proposal_share_links`, migration 0010)

| Ação                                                                    | Papel            | Esperado                                                                                   | Resultado                            |
| ----------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| `select * from proposals`                                               | `anon`           | 0 linhas                                                                                   | ✅ `anon_direct_select_proposals: 0` |
| `select * from proposal_share_links`                                    | `anon`           | 0 linhas (nunca expõe `token_hash` por leitura direta)                                     | ✅ `anon_direct_select_links: 0`     |
| `proposal_resolve_by_token(token válido)`                               | `anon` (via RPC) | resolve a versão exata vinculada ao link, nunca `token_hash`                               | ✅                                   |
| `proposal_resolve_by_token(token inexistente)`                          | `anon`           | 0 linhas                                                                                   | ✅                                   |
| `proposal_accept_by_token(token válido, "Nome A")`                      | `anon`           | grava `accepted_at`/`accepted_name`                                                        | ✅                                   |
| `proposal_accept_by_token(mesmo token, "Nome B")`                       | `anon`           | idempotente — devolve o registro já aceito, NÃO troca para "Nome B"                        | ✅ `accepted_name` continua "Nome A" |
| `insert into proposals` com `(implementation_id, version)` já existente | `commercial`     | rejeitado (`unique`) — garante que duas criações simultâneas da mesma versão nunca colidem | ✅ `23505 duplicate key`             |
| `insert into proposals`                                                 | `viewer`         | rejeitado                                                                                  | ✅ `42501`                           |
| `insert into proposals`                                                 | `commercial`     | aceito                                                                                     | ✅ linha criada                      |

## Templates de checklist e notas de proprietário (`checklist_templates`, `owner_notes`, migrations 0011/0012)

| Ação                                   | Papel        | Esperado                                                       | Resultado                                     |
| -------------------------------------- | ------------ | -------------------------------------------------------------- | --------------------------------------------- |
| `select * from checklist_templates`    | `anon`       | 0 linhas                                                       | ✅ `anon_can_see: 0`                          |
| `insert into checklist_templates`      | `operations` | aceito                                                         | ✅ linha criada                               |
| `select * from checklist_templates`    | `viewer`     | lê normalmente                                                 | ✅ `viewer_can_read: 1`                       |
| `insert into checklist_templates`      | `viewer`     | rejeitado                                                      | ✅ `42501`                                    |
| `select * from owner_notes`            | `anon`       | 0 linhas                                                       | ✅ `anon_can_see_notes: 0`                    |
| `insert into owner_notes`              | `commercial` | aceito                                                         | ✅ linha criada                               |
| `select * from owner_notes`            | `viewer`     | lê normalmente                                                 | ✅ `viewer_can_read: 1`                       |
| `update owner_notes` (tentando editar) | `viewer`     | 0 linhas afetadas (RLS filtra, nunca erro explícito em UPDATE) | ✅ confirmado por leitura: conteúdo não mudou |

## Owner Auth — leitura própria do proprietário (`owner_portal_accounts`, migration 0013)

| Ação                                                      | Papel                                          | Esperado                                             | Resultado                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `owner_account_link(token válido, com owner_id)`          | proprietário recém-cadastrado (via RPC)        | vincula `auth.uid()` ao `owner_id` do convite        | ✅ linha criada em `owner_portal_accounts`                                                  |
| `owner_account_link(mesmo token, mesmo usuário, de novo)` | idem                                           | idempotente — devolve a conta já vinculada, sem erro | ✅ mesmo `created_at`                                                                       |
| `owner_account_link(token expirado)`                      | proprietário                                   | rejeitado — `convite expirado`                       | ✅                                                                                          |
| `owner_account_link(token sem owner_id)`                  | proprietário                                   | rejeitado — `convite sem proprietário vinculado`     | ✅                                                                                          |
| `owner_account_link(qualquer token)`                      | `anon`                                         | rejeitado — `precisa estar autenticado`              | ✅                                                                                          |
| `select * from owner_records`                             | proprietário vinculado                         | só o próprio registro                                | ✅ 1 linha (o próprio)                                                                      |
| `select * from implementation_projects`                   | proprietário vinculado                         | só a implantação do próprio `owner_id`               | ✅ 1 linha                                                                                  |
| `select * from proposals`                                 | proprietário vinculado                         | só a proposta da própria implantação                 | ✅ 1 linha                                                                                  |
| `select * from initial_charges`                           | proprietário vinculado                         | só a própria cobrança                                | ✅ 1 linha                                                                                  |
| `select` nas quatro tabelas acima                         | um SEGUNDO proprietário (`owner_id` diferente) | 0 linhas em todas — isolamento entre proprietários   | ✅ `owner_records: 1` (só o próprio) `implementation_projects/proposals/initial_charges: 0` |

## Owner Tasks — "Precisamos de você" (`owner_tasks`, migration 0014)

| Ação                                  | Papel                       | Esperado                                     | Resultado                |
| -------------------------------------- | ---------------------------- | ----------------------------------------------- | -------------------------- |
| `select * from owner_tasks`           | `anon`                      | 0 linhas                                        | ✅ `anon_can_see: 0`      |
| `insert into owner_tasks`             | `operations`                | aceito                                          | ✅ linha criada           |
| `select * from owner_tasks`           | `viewer`                    | lê normalmente                                  | ✅ `viewer_can_read: 1`   |
| `insert into owner_tasks`             | `viewer`                    | rejeitado                                       | ✅ `42501`                |
| `select * from owner_tasks`           | proprietário dono da tarefa | vê a própria pendência                          | ✅ 1 linha                |
| `select * from owner_tasks`           | outro proprietário          | 0 linhas — isolamento                           | ✅ `owner_b_sees: 0`      |
| `update owner_tasks` (marcar `done`)  | proprietário dono da tarefa | 0 linhas afetadas (RLS filtra, sem erro)        | ✅ status continua `pending` |

## Attachments — Storage privado (`attachments`, `storage.objects`, migration 0015)

| Ação                                                           | Papel                       | Esperado                                       | Resultado                 |
| ---------------------------------------------------------------- | ---------------------------- | -------------------------------------------------- | --------------------------- |
| `select * from storage.objects where bucket_id = 'owner-attachments'` | `anon`                | 0 linhas                                           | ✅ `anon_can_see: 0`       |
| `insert into storage.objects` na própria pasta (`<owner_id>/...`) | proprietário                | aceito                                              | ✅ objeto criado           |
| `insert into storage.objects` na pasta de OUTRO proprietário     | proprietário                | rejeitado                                           | ✅ `42501`                 |
| `select * from storage.objects`                                  | outro proprietário           | 0 linhas — isolamento                               | ✅ `owner_b_sees: 0`       |
| `select * from storage.objects`                                  | `operations`                 | vê todos os objetos do bucket                       | ✅ `admin_sees: 1`         |
| `insert into attachments`                                        | `operations`                 | aceito                                              | ✅ linha criada            |
| `select * from attachments`                                      | proprietário dono do anexo   | vê o próprio anexo                                  | ✅ 1 linha                 |
| `select * from attachments`                                      | outro proprietário           | 0 linhas — isolamento                               | ✅ `owner_b_sees: 0`       |
| `delete from storage.objects` (SQL cru, sem `allow_delete_query`) | qualquer papel                | rejeitado pelo próprio Supabase                     | ✅ `42501` (gatilho `storage.protect_delete()`) |

## O que esta matriz NÃO cobre ainda

- **Upload/download reais via HTTP** (a API de Storage do supabase-js) —
  bloqueado por credencial externa, ver `docs/DATA_PERSISTENCE.md`
  §Attachments.
- **Login real via `supabase-js` (`signInWithPassword`/`signUp`)** — os testes
  acima simulam o papel/uid diretamente no Postgres; não exercitam o
  endpoint HTTP de Auth do Supabase de ponta a ponta (bloqueado por
  credencial externa — sem `VITE_SUPABASE_ANON_KEY` neste ambiente).
- **Concorrência real (duas conexões simultâneas de verdade)** — os
  testes de unicidade acima provam que o banco rejeita a colisão
  (`constraint` de banco, não checagem em memória do app), mas foram
  executados em sequência dentro da mesma sessão de teste, não como duas
  conexões de fato paralelas. Um teste de concorrência real (dois
  `INSERT`/RPC disparados ao mesmo tempo, de duas conexões) fica para a
  Fase 18C (Playwright multi-contexto).

## Nota de metodologia: `reset role` não limpa `request.jwt.claims`

Ao testar vários papéis na mesma transação (`set local role X; ...; reset
role; set local role Y; ...`), descobrimos que `reset role` só reseta o
papel do Postgres — **não** limpa `request.jwt.claims`, que é uma
variável de sessão separada. Isso quase gerou um falso positivo: testar
`anon` logo depois de testar um papel autenticado, sem também resetar
`request.jwt.claims` (ou setá-la para `'{}'`), faz `auth.uid()` continuar
devolvendo o uid do usuário anterior — então `has_admin_role(...)`
avaliava como se `anon` ainda fosse aquele usuário autenticado. Todo teste
de `anon` nesta matriz sempre inclui `set local request.jwt.claims to
'{}'` explicitamente, junto com `set local role anon`, para evitar esse
artefato. Em produção isto nunca acontece de verdade — cada requisição do
PostgREST é uma conexão/transação nova, sem estado residual de uma
requisição anterior — mas vale registrar como cuidado de teste.
