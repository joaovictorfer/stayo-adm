# Handoff — STAYO Admin · API V1

## Estado e origem
Fase 10A, 21/10/2026. Projeto consumidor independente; nenhum outro projeto foi modificado.
Origem real: `https://guia.stayogramado.com.br`; base V1: `https://guia.stayogramado.com.br/api/v1`.
Homologação 10B.1 (21/10/2026, sem credenciais): no domínio publicado `https://guia.stayogramado.com.br/api/v1`, health 200, catálogo público 200 vazio e todas as rotas privadas 401 JSON padronizado. `https://stayoapp.lovable.app` responde 302 para o domínio próprio — configurar sempre o domínio próprio e `redirect: 'error'`. Autenticação real ainda NÃO homologada.
Contrato operacional: `openapi-consolidated-v1.json`; inventário: `v1-inventario.md`.

## Autenticação e permissões
Aplicação técnica `stayo-admin`, atualmente inativa, escopo `admin:read`. Bearer exclusivo server-to-server, token opaco `stk_<prefixo>_<segredo>`; servidor mantém somente hash/prefixo. Escopos efetivos = token ∩ aplicação ∩ escopos habilitados. Sessão do administrador não substitui esse token.
401: ausente/inválido/expirado/revogado/aplicação inativa; 403: escopo insuficiente; 429: limite; 500: falha fechada. 120 req/min/IP e 600 req/min/aplicação. Respostas privadas `no-store`, `X-Request-Id`, envelope V1. Nunca registrar Authorization nem resposta pessoal integral.
`admin:read` permite consulta administrativa da operação STAYO; filtros NÃO são permissões por proprietário/tenant.

## Operações implementadas
- GET `/admin/properties`, `/admin/properties/{id}`: UUID, códigos, nome, localização cadastral, capacidade, status; `owners[]` N:N e `external_listing_ids[]` internos, **não IDs Airbnb**.
- GET `/admin/owners`, `/admin/owners/{id}`: identidade do proprietário, contatos administrativos, documento mascarado, `properties[]`, `contracts[]`.
- GET `/admin/reservations`, `/admin/reservations/{id}`: código, imóvel, datas, ocupação, nome do hóspede, canal original, estado, cancelamento. Bloqueios ocultam nome.
- GET `/admin/reservations/{id}/checkin` (`admin:read`): status, submissão/revisão, contagens e hóspedes com `is_primary`, status de selfie/revisão/convite e bloco `titular`. Sem `admin:sensitive`: `titular.document=null`, `document_visibility="restricted"` (a coluna nem é lida). Com `admin:read`+`admin:sensitive`: `document_status` (`missing|valid_cpf|non_cpf_document|invalid_cpf`) e documento **apenas do titular primário único**; 0 ou >1 titulares → `titular_status` `missing`/`ambiguous` e documento omitido. Selfies, URLs de fotos e documentos de acompanhantes nunca.
- GET `/admin/reservations/{id}/statement` (`admin:read`, Fase 1B): demonstrativo somente leitura — reserva, imóvel, `owners[]` (cadastro vigente, `owners_basis=current_property_registration`, não divisão histórica comprovada), `titular_guest` (nome, nunca CPF) e `finance` em centavos inteiros (`gross`, `platform_fee`, `cleaning`, `stayo_admin`, `stayo_total`, `owner_economic_value`) com `origin`/`reliability` da Fase 1A. Sem recebível: `finance.status="unavailable"` e todos `cents:null` (nunca R$ 0,00 fabricado). `owner_economic_value` é parcela econômica, não repasse pago. `updated_at` = máximo entre reserva, recebível e imóvel.
- GET `/system/whoami`: aplicação/escopos. GET `/health`: saúde mínima, sem garantia de funcionamento de todas as fontes.
- GET `/sync/events`; POST `/sync/events/ack`: confirmação exclusivamente técnica, não escrita comercial.
**Não existem** endpoints REST de criação/edição de imóveis, hóspedes, reservas, contratos, aprovação de check-in ou envio de mensagens. Contratos aparecem apenas como referências pelo imóvel vinculado; não há leitura do PDF nem prova individual de quem assinou. `admin:sensitive` existe no código (Fase 1B) mas nenhum token foi emitido com ele; a aplicação `stayo-admin` segue inativa.

## Filtros e paginação
Listagens: `limit=1..100` (50), `cursor`, `updated_since` ISO. Ordenação `updated_at DESC,id DESC`.
Reservas também: `property_id`, `owner_id`, `channel`, `status`, `checkin_from`, `checkin_to` (YYYY-MM-DD), `include_blocks=true`.
Não misturar cursor entre recursos/filtros. Processar todas as páginas; `data.page.next_cursor`, `has_more`. Guardar início da rodada e usar overlap na próxima; revarrer periodicamente. Relações/contratos alterados não necessariamente atualizam timestamp da tabela principal: **incremental não é snapshot transacional nem cobertura completa**.

## Exemplo fictício
```json
{"data":{"items":[{"id":"11111111-1111-4111-8111-111111111111","reservation_code":"RSV-FIXTURE","property_id":"22222222-2222-4222-8222-222222222222","guest_name":"Hóspede Exemplo","checkin_date":"2026-11-01","checkout_date":"2026-11-03","nights":2,"web_checkin_status":"approved","is_block":false}],"page":{"limit":50,"count":1,"has_more":false,"next_cursor":null}},"meta":{"request_id":"req_exemplo","api_version":"v1"}}
```
Exemplo parcial; schemas completos no OpenAPI.
```ts
// Dentro de handler protegido no backend consumidor, nunca no navegador.
const response = await fetch(`${base}/admin/reservations?limit=50`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  redirect: 'error', signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`stayo_api_${response.status}`);
const page = await response.json(); // validar schema e persistir somente campos autorizados
```
`base` é a base V1 fixa configurada no consumidor; `token` vem do armazenamento secreto, não parâmetro do usuário.

## Dados restritos e lacunas
Nome do hóspede acessível; telefone e e-mail **não acessíveis**. CPF/documento do titular só no checkin com `admin:sensitive` cumulativo; nunca no demonstrativo nem em logs. Não usar contatos do proprietário como contatos do hóspede. Não solicitar token de serviço privilegiado do banco. Endereços administrativos e contatos do proprietário não devem chegar ao Website. Senhas, chaves PIX, documentos, selfies, tokens do guia, raw PMS e instruções de acesso ficam omitidos.

## Matriz de privilégios (Fase 1B)
| Rota | admin:read | +admin:sensitive | finance:read | catalog:read |
|---|---|---|---|---|
| /admin/* (exceto checkin) | 200 | igual | 403 | 403 |
| /admin/reservations/{id}/checkin | 200 sem documento | 200 + documento do titular | 403 | 403 |
| /admin/reservations/{id}/statement | 200 sem CPF | igual (sem CPF) | 403 | 403 |
| só admin:sensitive | 403 | — | — | — |

O token da aplicação STAYO Admin é **exclusivamente servidor-servidor** e **não substitui** o controle de acesso de cada proprietário dentro do STAYO Admin: o consumidor deve filtrar por proprietário no próprio servidor antes de exibir qualquer dado.

## Atualização incremental
Mudanças financeiras (recebível) e de hóspedes/check-in **não alteram** necessariamente `reservations.updated_at`; `updated_since` em `/admin/reservations` não basta. Estratégia: (1) consumir `/sync/events` quando ativado; (2) até lá, revarredura periódica por janela de check-in (ex.: −30/+180 dias) chamando `/statement` e comparando `updated_at` consolidado; (3) `/checkin` deve ser relido quando `web_checkin_status` mudar ou na revarredura. Nunca tratar ausência de mudança em `reservations.updated_at` como prova de estabilidade financeira.

## Eventos e confirmação
Captura/entrega desligadas; feed vazio não significa ausência de alterações. Fazer bootstrap completo antes de qualquer ativação autorizada.
Eventos admin: reservation.created/updated/cancelled; reservation.checkin.completed/updated; property.created/updated/status.updated/availability.updated. completed é submissão, não aprovação.
Ler `after` do checkpoint durável, processar todos os IDs da página em ordem e persistir inbox/efeitos/cursor na mesma transação no consumidor. Só depois:
```http
POST /api/v1/sync/events/ack
Authorization: Bearer <segredo obtido do cofre do consumidor>
Content-Type: application/json

{"after":"0","event_ids":["11111111-1111-4111-8111-111111111111"]}
```
IDs fictícios. Enviar IDs exatos do feed, não IDs das entidades. ACK rejeita saltos, páginas de outra app e campos extras; repetição da página confirmada é idempotente. Leitura nunca avança. Não confirmar maior sequência de webhooks fora de ordem. Se ACK falhar, repetir antes da próxima página. Detalhes em `v1-events.md`.

## Checklist para conexão 10B — não executado
1. Autorizar publicação das rotas e credencial temporária específica; identificar proprietário responsável do projeto consumidor.
2. Administrador emissor usa `issueApiToken` com menor escopo/expiração; implementação interna existe, não há REST/UI de gestão ou ativação de app. Ativação técnica só por procedimento autorizado em Lovable Cloud.
3. Guardar token em segredo server-only do backend do consumidor, nunca `VITE_*`, arquivo público ou logs. Configurar origem fixa e timeout.
4. Testar whoami 200, imóveis/reserva fixture autorizada 200, financeiro 403, anônimo 401 e revogado 401. Não usar dados pessoais reais para fixtures.
5. Bootstrap/revarredura; avaliar projeção de contratos e necessidade adicional de contatos do hóspede, separadamente autorizada.
6. Revogar prefixo via função interna administrativa `revokeApiToken`; para emergência desativar/revogar a app, interromper jobs. Testar revogação e rotação.
7. Homologar inbox e ACK; manter eventos off até autorização distinta. Checklist PostgreSQL multi-sessão é bloqueante para ativação de eventos.

## Conexão do projeto Lovable consumidor (Fase 10B.1 — procedimento, não executado)
Este documento deve ser **copiado integralmente** para o projeto consumidor (colar no chat do outro projeto ou salvar em `docs/` lá). Um projeto Lovable não lê arquivos deste App.
1. **Variáveis:** `STAYO_API_BASE_URL=https://guia.stayogramado.com.br/api/v1` (pode ser config comum) e, quando houver escopo privado, `STAYO_API_TOKEN` como **secret do backend** do consumidor (Lovable Cloud → Secrets). Nunca prefixo `VITE_`, nunca no navegador, nunca em logs/chat.
2. **Servidor-servidor:** chamar só de server function/server route; `Authorization: Bearer <token>`, `Accept: application/json`, timeout 15 s, `redirect: 'error'`.
3. **Teste de autenticação:** `GET /system/whoami` → 200 com a aplicação/escopo esperados. Sem token → 401; escopo alheio → 403.
4. **Primeira consulta:** uma página `limit=10`; validar UUIDs, tipos e campos contra o OpenAPI; armazenar o `id` UUID da STAYO como chave externa (nunca nome ou código como chave).
5. **Erros:** 401 parar e alertar (credencial revogada/expirada); 403 não repetir; 429 respeitar `Retry-After` com backoff exponencial + jitter; 5xx/timeout tentar até 3x e depois marcar sincronização como pendente, mantendo os últimos dados válidos com data de atualização visível. Registrar `X-Request-Id`.
6. **Paginação/sincronização:** seguir `next_cursor` até `has_more=false`; incremental com `updated_since` e sobreposição; revarredura completa periódica. Eventos permanecem desligados.
7. **Revogação:** administrador STAYO revoga o prefixo (`revokeApiToken`); o consumidor remove o secret. Rotação = emitir novo, trocar o secret, validar whoami, revogar o antigo.
