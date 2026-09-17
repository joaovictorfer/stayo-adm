# WhatsApp — gateway, outbox e envio manual (Fase 9)

**Regra inviolável do plano master: nenhuma mensagem é enviada de
verdade em teste ou desenvolvimento.** O que existe hoje é genuíno e
funcional, mas o envio final é sempre um ato humano.

## `WhatsappGateway` (`src/lib/whatsapp/gateway.ts`)

Abstração formal — hoje só `MockWhatsappGateway` existe (ativo por
padrão), que nunca contata nenhum servidor de WhatsApp real. Quando um
provider real (WhatsApp Business API, por exemplo) existir, uma nova
implementação da mesma interface entra no lugar — nenhuma tela muda,
mesmo princípio de `CoreApiClient`/`AdminApiClient`.

## Outbox (`OutboundMessage`, tabela `outbound_messages`)

Toda mensagem passa por aqui **antes de qualquer tentativa de envio** —
nunca é disparada direto de uma tela. Estados: `draft → queued → sent |
failed | cancelled`. Sem provider real conectado, o status nunca chega a
`sent` de verdade sozinho — fica `queued` até alguém confirmar o envio
manual.

`adminApi.outbox.enqueue()` sempre nasce `queued`; `markSent`/`markFailed`
existem para quando o provider real confirmar (webhook de entrega, por
exemplo) — não usados ainda.

## O fallback manual: `wa.me`

`buildWhatsappDeepLink()` monta um link `https://wa.me/<telefone>?text=...`
— um recurso **público e legítimo do próprio WhatsApp** (preenche o texto
na conversa, mas só a pessoa aperta "Enviar"). Não é uma API simulando
envio; é a mesma coisa que colar um link de WhatsApp em qualquer lugar.
Satisfaz a regra "nunca enviar de verdade" mantendo a funcionalidade real
(o time realmente consegue mandar a mensagem, só que com um clique humano
no meio).

## Template

`proposalReadyMessage()` (`src/lib/whatsapp/templates.ts`) — texto
configurável num só lugar, nunca hardcoded na tela. Inclui o link do portal
da proposta (gera um se ainda não existir).

## UI

`ProposalTab` → "Finalizar e enviar por WhatsApp": monta a mensagem,
enfileira no outbox, mostra `WhatsappSendPanel` com "Copiar mensagem" e
"Abrir WhatsApp" (o link `wa.me`). Evento `proposal.sent` registrado na
auditoria.

## Persistência

`outbound_messages` já migrada (ver `docs/LOCALSTORAGE_MIGRATION.md`).
