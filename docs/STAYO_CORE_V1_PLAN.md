# Plano do contrato Core v1 — leitura, somente-leitura

Fase 19 (último entregável) → base para a Fase 20. Escopo do v1: **somente
leitura**, DTO-based, versionado, para `properties`, `condominiums`,
`reservations`, `guests` (com restrição de campos — ver nota sobre
Guest). Owner/Contrato/Financeiro e Mensagens ficam fora do v1 (ver
justificativa abaixo).

## Por que Owner/Contrato/Financeiro NÃO entram no v1

O prompt mestre original listava só `properties`/`condominiums`/
`reservations`/`guests` para o v1 — e isso continua correto, mas agora por
um motivo mais forte do que o originalmente suposto: `docs/STAYO_SOURCE_OF_TRUTH.md`
mostra que Owner/Contrato/Condições Comerciais têm um modelo de dados
maduro e em uso ativo no Core, e a forma como o Admin deve se conectar a
isso (leitura simples? escrita na conversão?) é uma decisão arquitetural
ainda pendente (ver seção final daquele documento). Expor essas entidades
no v1 antes dessa decisão arriscaria fixar um contrato errado. Ficam para
uma Fase 20b explícita, depois da decisão.

## Por que Guest entra com campos restritos, não completo

`docs/STAYO_DOMAIN_MAP.md` (seção Guest) documenta a maior superfície de
PII dos 4 domínios: documento completo, foto de documento, selfie, CPF,
resposta bruta de OCR. O v1 deve expor apenas:
`id`, `reservation_id`, `name`, `guest_type`, `is_primary`, `age_group` —
o suficiente para o Admin mostrar "quem está na reserva", nunca
documento/selfie/OCR. Qualquer necessidade futura de mais campos de Guest
é uma decisão de produto explícita, não uma expansão silenciosa do
contrato.

## Superfície do contrato v1

```
GET /core/v1/health
GET /core/v1/properties            (lista, paginada)
GET /core/v1/properties/:id
GET /core/v1/condominiums          (lista, paginada)
GET /core/v1/condominiums/:id
GET /core/v1/reservations          (lista, paginada, filtros: property_id, date range, status)
GET /core/v1/reservations/:id
GET /core/v1/reservations/:id/guests   (DTO restrito, ver acima)
```

Todas as respostas são DTOs — nunca a linha bruta da tabela. Isso permite
esconder colunas internas (senha de wifi, código de fechadura, campos de
sync/automação) e trocar a implementação interna sem quebrar contrato.

## Campos por DTO (baseado no schema real confirmado em `docs/STAYO_DOMAIN_MAP.md`)

- **PropertyDTO**: id, code, name, condominium_id (nunca o texto livre
  `condominium` — ver duplicidade documentada), address (city,
  neighborhood, full_address), max_guests, bedrooms, bathrooms,
  property_type, status, owner_id (via `owner_properties`, nunca
  `properties.owner_id` legado — mesma decisão que o próprio Core já
  tomou).
- **CondominiumDTO**: id, name, city, neighborhood, requires_tower,
  requires_unit, default_checkin_time, default_checkout_time.
- **ReservationDTO**: id, reservation_code, property_id, channel,
  checkin_date/time, checkout_date/time, adults, children, pets,
  reservation_status, web_checkin_status, guest_name (titular, não a
  lista completa de guests). IDs de canal via `pms_reservation_mappings`
  (fonte recomendada, não os campos planos legados — ver
  `docs/STAYO_DOMAIN_MAP.md` §Reservation).
- **GuestDTO** (restrito, só sob `/reservations/:id/guests`): id,
  reservation_id, name, guest_type, is_primary, age_group.

## Autenticação e autorização

Reaproveitar o padrão já existente no Core (não inventar um novo):
- `core_applications` (nova tabela, só para este contrato): `client_id`,
  `secret_hash` (nunca texto puro — mesmo padrão do Supabase Vault já
  usado para credenciais Condfy, `docs/STAYO_INTEGRATION_RISK_MAP.md`),
  `scopes` (array, ex.: `properties:read`, `reservations:read`),
  `active`, `last_used_at`.
- Autenticação via header `Authorization: Bearer <token>` — token de vida
  curta emitido a partir de `client_id`/`secret` (fluxo client-credentials
  simples), nunca o `secret` em si trafegando em toda requisição.
- Toda rota roda com o mesmo padrão de dois clientes que o Core já usa
  (`docs/STAYO_CORE_AUDIT.md` §6): um cliente de aplicação (não
  `service_role`) com suas próprias policies RLS restritas a
  `core_applications`, nunca reaproveitando `service_role` para esta API
  nova — isso é consistente com o achado de que hoje só o código de sync
  de canal usa `service_role`, e ele bypassa RLS por completo; a nova API
  não deve herdar esse bypass.
- Rate limiting: o Core hoje só tem rate limit real para consulta de CPF
  (`docs/STAYO_CORE_AUDIT.md` §8) — a nova API precisa do próprio, não
  pode assumir que existe proteção genérica de plataforma.
- Logs estruturados com `request_id`/`correlation_id` — o Core hoje não
  tem convenção centralizada (3 convenções ad-hoc distintas,
  `docs/STAYO_CORE_AUDIT.md` §7) — esta API deve estabelecer a própria,
  sem tentar se acoplar a nenhuma das três existentes.

## Onde implementar

Dentro do próprio `stayoapp` (Core), como o prompt mestre exige — nunca um
backend novo separado. Local natural dado o padrão já existente do
projeto: uma nova família de rotas `src/routes/api.core.v1.*.ts` (mesmo
padrão de `src/routes/api.public.*.ts` já usado para webhooks), com um
módulo `src/server/core-v1/` para os DTOs/queries, e uma migration nova
`core_applications` + RLS própria — seguindo exatamente o padrão de
autenticação por role já estabelecido (`has_role`/`is_staff`), mas para
aplicações, não usuários humanos.

## O que o Admin faz do outro lado (Fase 21, não implementado ainda)

`CoreApiClient` do Admin (`src/lib/api/core-client.ts`, hoje um mock)
ganha um adapter real que chama esta API via um BFF server-side do
próprio Admin (nunca expõe o `client_id`/`secret` do Core no browser) —
o mesmo padrão dual-adapter (local/Supabase) já usado para o resto do
Admin, estendido para um terceiro modo (mock/Core-real), escolhido pela
mesma lógica de `isSupabaseConfigured()`-style, nunca por um branch de UI.

## Status desta fase

Este documento é o **plano**, não a implementação. Nenhum código de Fase
20 foi escrito ainda nesta sessão — a Fase 19 (auditoria + este plano) é
o que está concluído e commitado. A Fase 20 (implementação real da API
dentro de `stayoapp`) é o próximo passo concreto, já desbloqueado (não
depende da decisão pendente de Owner/Contrato).
