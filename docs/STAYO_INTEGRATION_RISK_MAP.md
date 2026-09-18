# Mapa de risco de integrações — Stayo Core (STAYO.APP)

Fase 19. Auditoria estática (sem acesso a banco real, sem chamadas de
rede) do domínio de mensagens/WhatsApp/Ayrton/Condfy do repositório
`joaovictorfer/stayoapp`, marcado **RISCO ALTO** pelo prompt mestre. Toda
citação abaixo é de arquivo real lido nesta sessão; o que não foi
verificado está marcado como tal.

## Arquitetura atual (confirmada em código)

**Entrada (mensagens Ayrton):**
`POST /api/public/ayrton/webhooks/messages/{token}`
(`src/routes/api.public.ayrton.webhooks.messages.$token.ts`) → token
validado em tempo constante (`secretsMatch`) antes de qualquer
leitura/escrita → `captureShadowWebhookEvent`
(`src/server/ayrton-webhook-shadow.server.ts`) → dedupe por `event_id`
oficial (ou hash do payload) via RPC `SECURITY DEFINER`
`pms_webhook_event_capture`, `INSERT ... ON CONFLICT DO NOTHING` atômico
em `pms_webhook_events` → sempre responde HTTP 200. Um worker separado
(`src/server/ayrton-inbound-worker.server.ts`) drena esses eventos,
consulta `GET /conversations/{id}` (somente leitura, rate-limited),
normaliza em `pms_conversations`/`pms_messages` (upsert idempotente por
IDs oficiais), e resolve o vínculo com reserva **somente por ID oficial**
— nunca por telefone/nome.

**Proteção técnica real contra envio real a partir do caminho de
leitura**: `assertInboundReadOnlyEndpoint()`
(`src/lib/ayrton-inbound-normalizer.ts:521-525`) lança exceção se o worker
de entrada for apontado para qualquer endpoint que não seja de leitura —
não é só uma flag de configuração, é uma trava de código.

**Saída (envio real)**: ponto único de decisão
`assertOutboundSendAllowed`/`authorizeOutboundSend`
(`src/server/send-authorization.server.ts`,
`src/lib/send-authorization-policy.ts`) — emite uma "concessão" com
limite de tempo/uso que `providerSendText/Image/Document`
(`whatsapp-providers.server.ts`) e `sendStaysMessage`
(`stays-smm.server.ts`) precisam consumir ou lançam exceção.
**Não existe, hoje, nenhum caminho de código que envie mensagem real via
Ayrton** — os wrappers `ayrton.sendBookingMessage`/`sendConversationMessage`
existem mas não têm nenhum call site fora do próprio módulo (confirmado
por grep) e são adicionalmente gated pela flag
`AYRTON_MESSAGES_SEND_ENABLED`.

## Idempotência (real, confirmada nas migrations — não é lacuna aberta)

- `pms_webhook_events`: `UNIQUE (provider, kind, dedupe_key)` +
  `pms_webhook_event_capture` com `ON CONFLICT DO NOTHING`.
- `pms_conversations`: `UNIQUE (provider, external_conversation_id)`.
- `pms_messages`: `UNIQUE (provider, external_message_id)`; coluna gerada
  `ai_eligible` só é `true` se a mensagem estiver vinculada a uma reserva
  E não for histórico retroativo — trava de automação/IA a nível de
  schema, não só de aplicação.
- `pms_message_raw_payloads`: `UNIQUE (provider, payload_hash)`.

Isso resolve, no código atual, as lacunas de idempotência (I-01/I-03) que
a documentação interna do próprio Core datada de 30/07/2026 havia
apontado como abertas no mesmo dia — ou seja, **já foram corrigidas**,
não são um risco vigente.

## Segurança de webhook

- Ayrton: token na URL, comparação em tempo constante, checado **antes**
  de qualquer leitura/escrita; tentativas rejeitadas são logadas em
  `pms_webhook_attempts` só com um *fingerprint* do token, nunca o token
  bruto.
- BTZap/WhatsApp legado: token via header ou querystring, comparado
  contra tokens criptografados no banco
  (`whatsapp_api_integrations.webhook_token_encrypted`) ou fallback de
  variável de ambiente. **Risco aberto, não verificado como corrigido**: a
  URL de registro de webhook mostrada no painel embute o token na
  querystring (risco de vazamento em log de proxy/CDN) — apontado como
  R8 em `docs/auditoria-integracao-btzap.md`, sem confirmação de correção
  nesta auditoria.
- **Sem rate limiting** na própria rota de webhook Ayrton (apontado como
  R-08 em `docs/ayrton-mensagens/05_WEBHOOK_TOKEN_URL.md`, não verificado
  como corrigido nesta passada) — o cliente de API Ayrton em si tem
  limite de chamada (`AYRTON_MIN_CALL_INTERVAL_MS = 22_000`), mas isso não
  protege o endpoint de webhook contra abuso externo.

## Modelo de autenticação do worker Condfy

Dois mecanismos distintos, por design (`_shared/condfy-admin-auth.ts` e
`condfy-worker-auth.ts`, lidos na íntegra):
1. **Funções voltadas a admin** (`save-condfy-credentials`, etc.) —
   `requireAdmin()`: JWT bearer → `supabase.auth.getUser` → checa role
   `admin` em `user_roles`.
2. **Funções voltadas ao worker** (`condfy-claim-job`, `condfy-complete-job`,
   etc.) — `requireWorkerAuth()`: **segredo compartilhado único**
   `CONDFY_WORKER_SECRET`, comparado em tempo constante. A identidade do
   worker (`x-condfy-worker-id`) é checada contra o dono da linha do job,
   mas **não é ela mesma autenticada/assinada** — qualquer detentor do
   segredo compartilhado poderia se declarar como qualquer `worker_id`.
   **Risco real, mas modesto** (superfície de ataque exige já ter o
   segredo compartilhado) — registrado para o hardening (Fase 31), não
   urgente.

## Armazenamento de credenciais

- Credenciais de login do Condfy (email/senha reais de
  `web.condfy.com.br`) ficam no **Supabase Vault** —
  `condfy_connection_profiles.vault_username_reference`/`vault_password_reference`
  guardam apenas ponteiros UUID, acessados só via RPCs
  `SECURITY DEFINER` (`condfy_vault_store`/`update`/`read`), todos com
  `REVOKE ALL FROM PUBLIC, anon, authenticated` e execução restrita a
  `service_role`.
- A tabela `condfy_connection_profiles` é legível por admin/gerente, mas
  **nunca expõe o segredo em texto puro** — só e-mail mascarado e status.
- **Uma única função retorna a senha em texto puro por design**:
  `condfy-worker-get-login-credentials` — mas só para o worker externo já
  autenticado pelo segredo compartilhado, só para um job que ele
  atualmente possui, só enquanto o "lease" não expirou, só para
  `operation_type = 'connection_login_check'`. Sem nenhum call site em
  `src/` (não é alcançável do frontend/anon/authenticated).
- `whatsapp_credentials` (legado) guarda token **em texto puro** — risco
  real e ainda aberto por `docs/auditoria-integracao-btzap.md` (R7), mas
  restrito a roles staff/admin, não a `anon`.
- Nenhuma tabela legível por `anon` guarda segredo do Condfy ou token do
  WhatsApp/Ayrton.

## Achado novo: schema do Core já divergiu do branch `main`

Ver detalhe em `docs/STAYO_SOURCE_OF_TRUTH.md` — `types.ts` do Core lista
tabelas `condfy_invites`/`condfy_api_connections`/`condfy_api_events`/
`condfy_property_mappings`/`condfy_reconciliation_queue` sem nenhuma
migration correspondente em `supabase/migrations/` e sem nenhum código em
`src/`/`supabase/functions/` que as referencie — indício de migrations
aplicadas a partir de uma branch de feature não mesclada
(`feat/condfy-api-short-stay`). **UNCONFIRMED** se essas tabelas têm dado
real; **fato observável e verificado** que o types.ts e o histórico git
de `main` divergem.

## Os 5 problemas mais relevantes encontrados, com status

1. **Vínculo reserva↔conversa** — descoberta sequencial global de ID de
   conversa poluiu o banco com 1.103 conversas "estrangeiras" vazias de
   1.152 totais; só 2 de 49 conversas reais ficaram vinculadas a reserva.
   Causa raiz mais recente (doc de 17/09/2026): fila de mensagens sendo
   sufocada por tarefas de enriquecimento de reserva na mesma janela de
   cron. **Em correção/recém-diagnosticado, não confirmado resolvido.**
2. **Idempotência de webhook e tabela de mensagens** — **RESOLVIDO** no
   mesmo dia do apontamento (30/07/2026) — ver seção Idempotência acima.
3. **`whatsapp_conversations` legado mistura reservas sob um único
   telefone** — pode atribuir mensagem de hóspede repetido/telefone
   compartilhado à reserva errada. **Não resolvido** no caminho legado
   BTZap/WhatsApp; o novo modelo Ayrton (`pms_conversations`) já corrige
   isso via ID oficial, mas só para o caminho novo.
4. **5 endpoints públicos de drenagem sem autenticação**
   (`concierge-drain`, `airbnb-welcome-drain`, `guest-push-drain`,
   `staff-push-drain`, `revenue-queue-drain`) que podem disparar envio
   real quando o modo seguro/pausa de canal for liberado. **Não
   reverificado nesta passada — status desconhecido, tratar como aberto
   até confirmação.**
5. **Polling do Condfy usava endpoint de coleção inexistente
   (`GET /conversations`, 404) com descoberta de ID em sequência global**
   — corrigido em 03/09/2026 (trocado para `GET /conversations/{id}`
   direcionado); plano mais recente (11/09/2026) propõe substituir por
   webhook-first + poll direcionado — **iterativo, não confirmado
   completo**.

## Avaliação de risco de envio real

- **WhatsApp/Airbnb/Stays**: totalmente protegido por
  `assertOutboundSendAllowed` + flags `app_settings`
  (`whatsapp_safe_mode`, `whatsapp_globally_paused`, `channel_paused`) que
  falham fechado se ilegíveis. **Único bypass real por design**:
  `isManualForceException` (override manual de admin) — intencional e
  auditado, mas é um envio real de verdade quando acionado. **Não
  confirmado** se as flags de modo seguro/pausa global seguem `true` hoje
  (18/09) — os documentos de 30-31/07 as encontraram ativas, nenhum
  documento mais recente foi lido reafirmando o valor atual.
- **Ayrton**: nenhum caminho de envio existe hoje; dupla trava
  (`assertInboundReadOnlyEndpoint` + flag) — importar/rodar este código
  não pode, por si só, disparar uma mensagem real.
- **Condfy browser-worker** (`workers/condfy-browser-worker/`, serviço
  externo Playwright/Docker, não roda dentro do Lovable/Supabase): faz um
  **login real** em `web.condfy.com.br` com credenciais reais (puxadas em
  texto puro do Vault só para essa finalidade) e navega até uma página
  fixa para validar um breadcrumb, depois desloga. Nunca preenche/envia
  formulário de visitante, nunca cria uma liberação real — esses tipos de
  operação existem na constraint do banco mas não têm nenhum código que
  os exercite hoje.
- **Condfy API (schema novo, sem código)**: não pode disparar nada
  sozinho — mas é "arma carregada sem gatilho": se o branch de feature
  associado for mesclado sem revisão, o schema já está pronto e populado
  de referências a segredo.

## O que não foi verificado (não inventado, marcado como tal)

- Valores atuais das flags `app_settings` (modo seguro, pausa global,
  `AYRTON_MESSAGES_SEND_ENABLED`) — nenhuma consulta a banco foi feita.
- Se os 5 endpoints de drenagem sem autenticação (item 4 acima) seguem
  sem autenticação hoje.
- Conteúdo de `process-expense-ocr` (fora do escopo deste domínio).
- Não há histórico git utilizável para arqueologia — o clone tem um único
  commit (`305e4f8`, 17/09/2026), snapshot sincronizado do Lovable, não o
  histórico completo real.

## Regra operacional para as Fases 20-31

Nenhuma fase futura deste plano deve, em nenhuma circunstância, escrever
no caminho de envio real (WhatsApp/Ayrton/Condfy) descrito acima. A Fase
26 (Mensagens no Admin) é explicitamente somente-leitura — isso está
tecnicamente alinhado com o que já existe no Core (dupla trava de
somente-leitura no worker de entrada), então a integração do Admin deve
espelhar esse mesmo padrão de trava dupla, nunca assumir que "só ler é
seguro por padrão" sem a mesma proteção explícita em código.
