# Auditoria do STAYO Core (STAYO.APP) — Fase 19

Auditoria estática (sem consulta a banco real, sem chamada de rede) do
repositório `joaovictorfer/stayoapp`, clonado em `/home/user/stayoapp`
(HEAD `305e4f8`, snapshot único sincronizado do Lovable — não há
histórico git completo). Executada por 4 subagentes desta sessão, cada um
restrito a um domínio, todos com instrução explícita de citar arquivo e
marcar "UNCONFIRMED"/"NOT FOUND" em vez de inferir. Este documento
consolida a visão de infraestrutura/plataforma; os domínios de negócio
(Owner/Contrato/Financeiro, Property/Reservation/Guest/Condominium) têm
detalhe próprio em `docs/STAYO_DOMAIN_MAP.md`, e o risco de
mensagens/Ayrton/Condfy em `docs/STAYO_INTEGRATION_RISK_MAP.md`.

## 1. Escala real do projeto

854 migrations SQL, ~30.151 linhas de tipos gerados
(`src/integrations/supabase/types.ts`), dezenas de rotas em
`src/routes/`, docs internos extensos (`docs/ayrton-mensagens/`,
`docs/contracts-stabilization.md`, dezenas de planos datados em
`.lovable/plan/` até 17/09/2026 — um dia antes desta auditoria). Este não
é um projeto em estágio inicial: é um sistema de produção maduro,
ativamente mantido, com testes automatizados e CI.

## 2. Configuração Supabase / edge functions

`supabase/config.toml` é uma única linha (`project_id`) — nenhuma seção
`[functions.*]`/`[auth]`/cron. Isso significa que **toda** função edge
roda com o default de plataforma `verify_jwt = true`, a menos que isso
tenha sido desligado fora do repositório (no dashboard do
Lovable/Supabase) — **UNCONFIRMED**, não verificável por leitura estática.

11 funções edge existem, todas em `supabase/functions/`, nenhuma delas
serve dado do domínio Property/Reservation/Guest/Condominium (são todas
Condfy admin/worker + `process-expense-ocr`):

| Função                                                                                                                                                                      | Autenticação real (código)                                                                     | Observação                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condfy-artifact-signed-url`                                                                                                                                                | JWT + role admin                                                                               | URL assinada de 5 min para artefato de job                                                                                                                                                  |
| `condfy-claim-job` / `-complete-job` / `-fail-job` / `-get-job-payload` / `-job-heartbeat` / `-worker-artifact-upload` / `-worker-get-login-credentials` / `-worker-health` | Segredo compartilhado `CONDFY_WORKER_SECRET` + ownership do job                                | Ver `docs/STAYO_INTEGRATION_RISK_MAP.md` para o detalhe de risco                                                                                                                            |
| `get-condfy-connection-status`                                                                                                                                              | JWT + role em {admin, gerente_operacional, manager}                                            | Status não sensível                                                                                                                                                                         |
| `save-condfy-credentials`                                                                                                                                                   | JWT + role admin                                                                               | Grava credencial no Vault, nunca em texto puro na tabela                                                                                                                                    |
| `process-expense-ocr`                                                                                                                                                       | **nenhuma checagem própria no código** — depende só do default de plataforma `verify_jwt=true` | **Achado de hardening**: se esse default for desligado globalmente por qualquer motivo, esta função fica aberta. Chama o Lovable AI Gateway (`google/gemini-2.5-flash`) para OCR de recibo. |

## 3. Cron / filas / webhooks (infraestrutura confirmada)

Tudo via `pg_cron` (`cron.schedule`) + `pg_net` (`net.http_post`) —
nenhum `pg_boss` encontrado. Pelo menos 13 jobs agendados confirmados nas
migrations, entre eles:

- `ayrton-reservation-reconcile-hourly` (hora em hora) — reconciliação de
  reservas Ayrton.
- `ayrton-message-poll-10min`, `ayrton-queue-drain-1min` — fila genérica
  `pms_api_queue` (prioridade/rate-limit/retry/`correlation_id`).
- `op-generate-routine-tasks` (diário 3h) — gera tarefas operacionais de
  limpeza/manutenção (`op_tasks`).
- `expire-late-booking-decisions-hourly`, `guide-exception-rules-expire`
  (diário) — housekeeping de domínio.
- `drain-staff-push`, `drain-guest-push`, `concierge-drain-every-minute`,
  `wa-process-queue`, `airbnb-message-drain-1min` (todos a cada 1-5 min)
  — drenam outboxes via `net.http_post` para rotas públicas do próprio
  app, protegidas por segredo compartilhado (`x-cron-token`,
  `CRON_SECRET`, `DRAIN_CRON_SECRET`, `STAYO_INTERNAL_SECRET`).

**Achado de hardening**: a migration do job `concierge-drain-every-minute`
(`supabase/migrations/20260516120843_47f5dfca-...sql:17`) tem uma chave
anon do Supabase **em texto puro, hardcoded**, como header `apikey`. É a
chave anon (não `service_role` — risco baixo por si só, é uma chave
pensada para ser pública), mas o padrão de hardcoding em migration é ruim
porque a chave não pode ser rotacionada sem uma nova migration. Registrar
para a Fase 31 (hardening).

Outras filas encontradas, não cron-drivadas (drenadas pelo próprio
servidor da app): `ai_response_jobs` (resposta de IA debounced),
`condfy_dispatch_jobs` (fila de jobs do worker Condfy, `FOR UPDATE SKIP
LOCKED`), `whatsapp_archive_jobs`.

**Dois "workers" diferentes, não confundir**: `workers/condfy-browser-worker/`
é um processo Node/Docker autônomo (não é um Cloudflare Worker apesar do
nome do diretório) que faz polling a cada 5s contra `condfy-claim-job` e
roda checagens de login via Playwright. O Cloudflare Worker de verdade é
a própria aplicação inteira (`wrangler.jsonc`: `main:
"@tanstack/react-start/server-entry"`) — o app TanStack Start SSR é
hospedado no Cloudflare Workers.

## 4. CI/CD

`.github/workflows/ci.yml` (lint→typecheck→test→build, sem deploy),
`guide-validation.yml` (idem, escopo guia), `cortex.yml`
(`workflow_dispatch` manual, gera mapa do projeto, não é deploy). **Não
existe pipeline de deploy neste repositório** — nenhum workflow chama
`wrangler deploy` ou `supabase functions deploy`. A publicação de
produção quase certamente é feita fora de banda pelo Lovable Cloud
(auto-sync), mas isso é **UNCONFIRMED** por leitura estática de código.

## 5. Variáveis de ambiente / segredos

Inventário completo obtido via grep de `Deno.env.get`/`import.meta.env.`/
`process.env.` em todo o repositório. **Nenhuma violação de segredo lido
em código client-bundle foi encontrada** — tudo sob `src/components/` e
corpos de rota renderizados no cliente só lê `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` (anon) e uma chave "demo" pública do
Google Maps. Todo o resto (Ayrton, Stays, BTZap/Wapi WhatsApp, CPF
lookup, VAPID push, segredos de cron/drain, `SUPABASE_SERVICE_ROLE_KEY`,
`LOVABLE_API_KEY`) é lido exclusivamente em `src/server/*.server.ts`,
`*.functions.ts` (`createServerFn`) ou rotas `api.*` — nunca em código
renderizado no cliente.

`.env.example` do repositório é **enganosamente incompleto** (só lista 4
variáveis) — a superfície real de env vars é muito maior e vive
majoritariamente no dashboard da plataforma Lovable, não no repositório.
Qualquer trabalho futuro que precise saber "quais segredos existem" deve
usar o grep de `process.env`/`Deno.env.get`, nunca `.env.example`.

## 6. Modelo de autenticação e autorização

Supabase Auth (GoTrue) padrão, com um padrão correto e não-ingênuo:
o servidor **revalida** o JWT chamando `supabase.auth.getUser(token)` em
vez de confiar apenas na claim que o cliente afirma
(`src/integrations/supabase/auth-middleware.ts`). Cliente `service_role`
(`client.server.ts`) é explicitamente isolado em arquivos `.server.ts`,
com comentário próprio no código alertando para nunca expor ao cliente.

Papéis em `public.app_role` (enum, expandido ao longo do tempo:
admin/manager/staff/cleaner/maintenance/gerente_operacional/
funcionario_operacional/financeiro/owner) guardados em tabela separada
`user_roles` (não no JWT nem no perfil — evita escalonamento de
privilégio via update de perfil). Autorização é decidida **via RLS**
usando funções `SECURITY DEFINER` (`has_role()`, `is_staff()`) — não
apenas checagem no app. **Achado**: existem duas funções `has_role` com
assinaturas diferentes coexistindo (`has_role(uuid, app_role)` original e
um overload posterior `has_role(text[])` usando `auth.uid()` interno) —
não é um bug, mas qualquer API nova que reutilize esse padrão precisa
saber que há duas assinaturas, não uma.

### RLS gap real, achado nesta auditoria

`public.reservation_phone_logs` (histórico de troca de telefone de
hóspede por reserva) tem policies:

```sql
CREATE POLICY "Enable select for authenticated" ON public.reservation_phone_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated" ON public.reservation_phone_logs FOR INSERT TO authenticated WITH CHECK (true);
```

(`supabase/migrations/20260529005734_3e063ace-fb3d-499c-9194-10e333d9310e.sql`)
— **qualquer usuário autenticado** (não só staff) pode ler/inserir nessa
tabela com dado de hóspede. RLS está habilitada mas efetivamente
permissiva. Existem 33 ocorrências de `USING (true)` no total nas
migrations; a amostra verificada nesta auditoria mostrou a maioria sendo
tabelas de referência pública legítimas (categorias/tags) ou policies
`service_role`-only redundantes-mas-seguras — **esta é a única com PII
real encontrada na amostra**, mas as 33 não foram todas enumeradas.
**Recomendação explícita para antes de expandir o acesso de leitura do
Admin**: uma passada dedicada listando as 33 por tabela+role, e corrigir
`reservation_phone_logs` (adicionar `is_staff(auth.uid())`) na Fase 31.

## 7. Observabilidade

**Nenhuma ferramenta de error-tracking** (Sentry/Bugsnag/etc. — zero
ocorrências). **Nenhuma lib de logging estruturado** (sem
pino/winston) — logging é `console.log`/`console.error` ad hoc. Existem
3 convenções independentes e não-centralizadas de correlation-id
(`ayrton-client.server.ts`, `send-authorization.server.ts`,
`ai-concierge-v2-1.server.ts`) — nenhum middleware global de request-id.
**Se a nova API do Admin quiser correlation-id, terá que criar a própria
convenção — não há nada pronto para se acoplar.**

## 8. Rate limiting

Só existe uma implementação real: `check_cpf_lookup_rate_limit` (RPC),
usada nos dois fluxos de consulta de CPF (admin e web check-in público),
com fail-closed explícito em erro de infraestrutura. **Não existe rate
limiting genérico** protegendo `/api/public/*` (webhooks, drains) — esses
dependem só de posse de segredo compartilhado, não de limitação de
volume.

## Resumo de achados de hardening para a Fase 31 (registrados, não corrigidos nesta fase)

1. `process-expense-ocr` sem checagem de auth própria no código (depende
   só do default de plataforma).
2. Chave anon hardcoded em texto puro numa migration
   (`20260516120843_...sql`).
3. RLS efetivamente permissiva em `reservation_phone_logs` (PII de
   telefone de hóspede) — e as 33 policies `USING (true)` no total não
   foram todas auditadas.
4. Segredo único compartilhado (`CONDFY_WORKER_SECRET`) para toda a frota
   de workers Condfy, sem autenticação própria por worker.
5. Sem error-tracking, sem logging estruturado, sem correlation-id
   centralizado.
6. Sem rate limiting genérico em rotas públicas além do CPF lookup.
7. Schema do banco já divergiu do histórico `main` (tabelas
   `condfy_invites`/`condfy_api_connections`/etc. sem migration
   correspondente — ver `docs/STAYO_SOURCE_OF_TRUTH.md`).

## O que não foi verificado

- Se `verify_jwt` está de fato ligado/desligado por função no dashboard
  da plataforma (fora do repositório).
- Mecanismo real de deploy de produção (provavelmente Lovable auto-sync,
  não confirmado).
- Enumeração completa das 33 policies `USING (true)`.
- Nenhuma consulta ao banco real foi feita em nenhum momento desta
  auditoria.
