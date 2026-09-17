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

## O que esta matriz NÃO cobre ainda

- **Owner Auth** (proprietário autenticado por conta própria, não só por
  token) — não existe ainda, ver `docs/AUTH_AND_ROLES.md`. Não há RLS de
  "proprietário só vê o próprio registro" para testar.
- **`proposals`/`implementation_projects`/demais tabelas ainda sem
  schema** (ver `docs/LOCALSTORAGE_MIGRATION.md`) — não existem no banco
  ainda, então não há RLS para testar.
- **Login real via `supabase-js` (`signInWithPassword`)** — os testes
  acima simulam o papel/uid diretamente no Postgres; não exercitam o
  endpoint HTTP de Auth do Supabase de ponta a ponta (bloqueado por
  credencial externa — sem `VITE_SUPABASE_ANON_KEY` neste ambiente).
