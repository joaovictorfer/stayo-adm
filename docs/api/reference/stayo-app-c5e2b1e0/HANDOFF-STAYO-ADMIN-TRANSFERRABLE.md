# STAYO Admin — Pacote transferível de consumo da API V1 (Fase 1B)

Documento autocontido para o projeto consumidor STAYO Admin. Nada foi ativado: nenhum token emitido, aplicação `stayo-admin` inativa, nenhuma migration aplicada, nada publicado.

## 1. Conexão
- Base: `https://guia.stayogramado.com.br/api/v1` (usar sempre o domínio próprio; `redirect: 'error'`).
- Header: `Authorization: Bearer stk_<prefixo16hex>_<segredo43>`; guardar como segredo de servidor do consumidor.
- O token é **exclusivamente servidor-servidor**. Nunca no navegador. **Não substitui** o controle de acesso por proprietário dentro do STAYO Admin — o consumidor aplica esse filtro no próprio servidor.
- Envelope: `{ data, meta: { request_id, api_version } }`; erros `{ error: { code, message, details? }, meta }`. Respostas privadas `Cache-Control: no-store`.
- Códigos: 400 invalid_request (UUID inválido), 401 unauthorized, 403 forbidden (escopo), 404 not_found, 429 rate_limited (120/min/IP, 600/min/app), 500 internal_error.

## 2. Escopos
| Escopo | Concede |
|---|---|
| admin:read | Todas as rotas `/admin/*` |
| admin:sensitive | Só amplia `/admin/reservations/{id}/checkin` com documento do titular; exige `admin:read` cumulativo |
| finance:read | Rotas `/finance/*` (sem acesso a `/admin/*`) |
| catalog:read | Catálogo |
Escopos efetivos = token ∩ aplicação ∩ escopos habilitados.

## 3. Rotas administrativas
- `GET /admin/properties[/{id}]`, `/admin/owners[/{id}]`, `/admin/reservations[/{id}]` — ver OpenAPI.
- `GET /admin/reservations/{id}/checkin`
  - Sempre: status, submissão/revisão, contagens, hóspedes (sem documento), `titular.titular_status` (`resolved|missing|ambiguous`).
  - Sem admin:sensitive: `titular.document=null`, `document_status=null`, `document_visibility="restricted"`.
  - Com admin:sensitive: `document_status` ∈ `missing|valid_cpf|non_cpf_document|invalid_cpf`; `document` = CPF formatado (`000.000.000-00`) se válido, documento bruto se não-CPF, `null` se ausente/inválido. Titular ausente/ambíguo → `document_visibility="omitted_unresolved_titular"` e nada é escolhido.
  - Nunca: selfies, URLs de fotos, documentos de acompanhantes.
- `GET /admin/reservations/{id}/statement`
  - `reservation`, `property`, `owners[]` (`owner_id`, `owner_name`, `ownership_percent`, `role`) com `owners_basis="current_property_registration"` (cadastro vigente, não divisão histórica comprovada).
  - `titular_guest` `{status, name}` — nunca CPF.
  - `finance.status` `available|unavailable`; campos `gross`, `platform_fee`, `cleaning`, `stayo_admin`, `stayo_total`, `owner_economic_value`, cada um `{cents:int|null, currency:"BRL", origin, source, reliability}`.
  - `origin`: `real` (integração observada), `manual`, `estimated` (regra), `missing`, `indeterminate`. `reliability`: `confirmed|pending_reconciliation|unavailable`. Observação integrada não prova recebimento.
  - Sem recebível/cálculo pendente: `unavailable`, todos `cents:null`. Nunca exibir como R$ 0,00.
  - `owner_economic_value` é parcela econômica calculada — **não** é repasse realizado/pago.
  - `updated_at` = máximo entre reserva, recebível e imóvel.

## 4. Atualização incremental
1. `/admin/reservations?updated_since=` detecta só mudanças na própria reserva.
2. Mudanças de recebível e hóspedes podem não tocar `reservations.updated_at`.
3. Até eventos serem ativados (`/sync/events` + ack): revarredura periódica (ex. a cada 15–60 min) da janela de check-in relevante chamando `/statement`, comparando `updated_at` consolidado e persistindo o último visto.
4. Reler `/checkin` quando `web_checkin_status` mudar e na revarredura.

## 5. Privacidade
- Não registrar `Authorization`, documento, nem corpo integral de respostas em logs.
- CPF só no checkin com admin:sensitive; tratar como dado pessoal restrito no consumidor.

## 6. Pendências antes do uso real
- Emitir token (decisão administrativa) e ativar a aplicação — não feito.
- Se a tabela de aplicações/tokens restringir escopos no banco, permitir `admin:sensitive` via migration versionada — não aplicado.
- Homologação autenticada real — não executada.
