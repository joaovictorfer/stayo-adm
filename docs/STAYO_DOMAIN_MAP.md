# Mapa de domínio — Stayo Core (STAYO.APP)

Fase 19. Um bloco por domínio, campos fixos pedidos pelo prompt mestre:
fonte oficial, tabelas, PK, IDs externos, relacionamentos, quem
cria/altera/lê, integrações dependentes, RLS, PII, risco, duplicidades,
problemas, ação recomendada. Evidência: auditoria estática de 4
subagentes contra `/home/user/stayoapp` (854 migrations, `types.ts` de
~30k linhas). Sem consulta a banco real em nenhum momento. Detalhe bruto
por domínio: ver `docs/STAYO_SOURCE_OF_TRUTH.md` (Owner/Contrato/
Financeiro) e `docs/STAYO_INTEGRATION_RISK_MAP.md` (Mensagens).

---

## PROPERTY (imóvel)

- **Fonte oficial**: Core (`properties`).
- **Tabelas**: `properties` (PK `id uuid`, ~85 colunas) + satélites
  `property_photos`, `property_files`, `property_faqs`, `property_documents`
  (financeiro, não identidade), `property_costs`, `property_commercial_terms`,
  `property_inventory_environments/items/versions`, `property_operational_status`,
  `property_payout_settings` (+ view `_public`), `owner_properties`,
  `pms_listing_mappings`, `condfy_property_mappings`.
- **IDs externos**: não na tabela `properties` em si — vivem em
  `pms_listing_mappings` (`external_listing_id/code`, `external_channel`,
  `provider`, `mapping_status`, `confidence`) e `condfy_property_mappings`
  (`connection_id`, `condfy_condominium_name`, `condfy_license_condominium_name`).
- **Relacionamentos**: `condominium_id→condominiums`, `owner_id→owners`/
  `owners_public`. `auto_created_from_listing` indica criação automática
  a partir de listing de canal (Airbnb/Stays).
- **Quem cria/altera**: admin manual (`admin.properties.$id.tsx`, RLS-enforced,
  autenticado); sync externo de listing (candidatos `stays-*.server.ts`,
  writer exato de `pms_listing_mappings` não rastreado até o arquivo —
  UNCONFIRMED); Condfy edge functions + `workers/condfy-browser-worker/`
  escrevem só o mapeamento de acesso físico.
- **Quem lê**: guia do hóspede, portaria/operacional, portal do
  proprietário (via `owners_public`+`owner_properties`), motor de
  precificação, automação de WhatsApp.
- **Integrações dependentes**: Stays/Airbnb (listing), Condfy (controle de
  acesso físico do condomínio/portaria).
- **RLS**: habilitada. Endurecida em 24/07/2026
  (`20260724041448_...sql`): baseline `properties_staff_all` (qualquer
  staff) substituída por `properties_admin_manager_all`
  (`is_op_manager`) + nova policy mais estreita
  `properties_staff_related_select` (SELECT só onde o staff tem
  tarefa/vistoria/rotina atribuída via `staff_can_access_property()`).
  Sem policy `anon`.
- **PII**: baixa/nenhuma direta (endereço do imóvel, não de pessoa) —
  wifi/senha/código de acesso são dado sensível operacional, não PII.
- **Risco**: médio — dado operacional sensível (senha de wifi, código de
  fechadura) trafega em texto puro na tabela, acessível a qualquer staff
  autorizado; nenhuma criptografia em repouso identificada nesta
  auditoria (UNCONFIRMED se há criptografia a nível de coluna).
- **Duplicidades confirmadas**:
  1. `properties.owner_id` (legado) vs. `owner_properties` (moderno,
     multi-proprietário com % de posse/payout) — **confirmado
     explicitamente pelo próprio time do Core** em
     `.lovable/plan/plan-canonical-owner-property-relationship-layer-2026-08-19.md`,
     que declara literalmente que funções novas ignoram
     `properties.owner_id` por ser legado, mas a coluna segue lida em
     `src/lib/staff.functions.ts`.
  2. `properties.condominium` (texto livre, do schema fundação) vs.
     `properties.condominium_id` (FK, adicionada 5 dias depois) — **ambas
     ainda lidas ativamente** em 3 arquivos (`owner-data-requests.functions.ts`,
     `reservation-owner-pdf.ts`, `staff.functions.ts`), sem plano de
     depreciação encontrado.
- **Problemas conhecidos**: as duas duplicidades acima; sync automático de
  listing não totalmente rastreado nesta auditoria.
- **Ação recomendada**: o contrato Core v1 (Fase 20) deve expor
  `condominium_id` (nunca o texto livre `condominium`) e `owner_properties`
  (nunca `properties.owner_id` direto) como os campos canônicos — herdando
  a mesma decisão que o próprio time do Core já tomou, não uma nova.

---

## CONDOMINIUM (condomínio)

- **Fonte oficial**: Core (`condominiums`).
- **Tabelas**: `condominiums` (PK `id uuid`, ~55 colunas) — sem FKs
  próprias de saída; referenciada por `properties.condominium_id`,
  `condfy_property_mappings.condominium_id`, `guest_tips.condominium_id`.
- **IDs externos**: nenhum direto na tabela; ligação com Condfy só via
  `condfy_property_mappings` (que carrega DOIS nomes distintos do lado
  Condfy — `condfy_condominium_name` e `condfy_license_condominium_name`,
  significado exato não confirmado).
- **Relacionamentos**: 1—N com `properties`.
- **Quem cria/altera**: **somente admin manual**
  (`src/lib/condominiums.functions.ts`, autenticado via
  `requireSupabaseAuth`) — nenhum sync externo escreve nesta tabela
  diretamente.
- **Quem lê**: admin, guia do hóspede (via join com `properties`),
  portaria (regras de veículo/torre/unidade), automação de concierge.
- **Integrações dependentes**: Condfy (indireto, via `properties`).
- **RLS**: habilitada, mas **não foi encontrada nenhuma migration que a
  tenha endurecido** na mesma passada de segurança de 24/07/2026 que
  atingiu `properties`/`reservations`/`guests` — segue com a policy
  original de 07/05/2026 (`condominiums_staff_all`, qualquer role de
  staff, não só admin/manager). **Inconsistência real**: condomínio tem
  controle de acesso mais permissivo que seus imóveis filhos.
- **PII**: mínima (contato do porteiro/concierge do prédio, não de
  hóspede).
- **Risco**: baixo a médio — o risco não é vazamento de PII, é a
  inconsistência de modelo de autorização citada acima.
- **Duplicidades**: nenhuma encontrada.
- **Problemas conhecidos**: RLS não endurecida junto com os domínios
  irmãos; forma atual exata do RPC de guia (`get_guide_by_token`) que
  expõe dados de condomínio ao hóspede não foi re-lida na versão mais
  recente — UNCONFIRMED se ela expõe mais do que deveria antes da
  aprovação do web check-in.
- **Ação recomendada**: antes de expor `condominiums` via API do Core
  (Fase 20), aplicar a mesma política `is_op_manager` que já existe em
  `properties`/`reservations`/`guests`, para não deixar o domínio menos
  protegido criando uma nova via de leitura sobre ele.

---

## RESERVATION (reserva)

- **Fonte oficial**: Core (`reservations`).
- **Tabelas**: `reservations` (PK `id uuid`, ~140 colunas) + satélites
  `guests`, `guest_slots`, `reservation_vehicles`, `reservation_phone_logs`,
  `reservation_sync_audit/conflicts`, `web_checkin_logs`,
  `public_checkin_lookups`, `pms_reservation_mappings`,
  `finance_reservation_receivables`, `whatsapp_conversation_reservations`,
  `condfy_invites`.
- **IDs externos**: campos diretos na própria tabela (`channel`,
  `channel_reservation_id`, `external_reservation_id/code`,
  `external_listing_id`, `provider`, `source_channel`) **e** uma tabela
  satélite separada `pms_reservation_mappings` (mesmo conceito, por
  provedor, suporta múltiplas identidades de canal simultâneas por
  reserva).
- **Relacionamentos**: `property_id→properties`,
  `guest_person_id→guest_persons`.
- **Quem cria/altera**: admin manual
  (`admin.reservations.$id.tsx`, RLS-enforced); sync Ayrton
  (`ayrton-webhook-ingest.server.ts`, `ayrton-reservation-refresh.server.ts`,
  `ayrton-auto-import.server.ts`, `ayrton-contingency.server.ts`) via
  cliente `service_role` (bypassa RLS); sync Stays
  (`stays-fresh-sync.server.ts`, `stays-calendar-sync.server.ts`) idem;
  hóspede via RPCs `SECURITY DEFINER` gated por `guide_token`/token de
  check-in (nunca escrita direta de tabela).
- **Quem lê**: guia do hóspede, check-in, dashboard/lista admin,
  portaria, relatórios financeiros/proprietário.
- **Integrações dependentes**: Ayrton (PMS principal), Stays (PMS
  alternativo), Condfy (convite de acesso), WhatsApp/Airbnb (mensagens).
- **RLS**: habilitada. Endurecida em 24/07/2026: baseline
  `reservations_staff_all` (`is_staff`) → `reservations_admin_manager_all`
  (`is_op_manager`, mais restrito). **Nenhuma policy `anon`** — todo
  acesso público é via RPC `SECURITY DEFINER` (`get_guide_by_token`,
  `get_checkin_form`, `submit_web_checkin`, etc.), nunca RLS direta na
  tabela. Um trigger recente (`trg_reservation_reconcile_automations`,
  11/09/2026) reconcilia a fila de automação em qualquer UPDATE,
  cobrindo todos os caminhos de escrita (manual/Ayrton/webhook/polling).
- **PII**: nome/telefone/e-mail/documento do hóspede titular, placa de
  veículo, nome de assinatura LGPD — a PII mais sensível (foto de
  documento/selfie) fica no domínio Guest, não aqui.
- **Risco**: alto — é o domínio mais mutável (140 colunas, múltiplos
  writers concorrentes: manual + 2 PMS externos + triggers automáticos).
  `reservation_phone_logs` (achado de RLS gap, ver
  `docs/STAYO_CORE_AUDIT.md`) permite que qualquer usuário autenticado
  (não só staff) leia/escreva histórico de troca de telefone de hóspede.
- **Duplicidades confirmadas**: IDs de canal existem tanto como colunas
  planas em `reservations` quanto como linhas em
  `pms_reservation_mappings` — **qual é autoritativo por provedor não foi
  determinado** (UNCONFIRMED, exigiria ler a ordem de escrita do código
  de sync, fora do escopo desta passada).
- **Problemas conhecidos**: RLS permissiva em `reservation_phone_logs`
  (achado novo desta auditoria, não documentado internamente antes);
  duplicidade de ID de canal não resolvida.
- **Ação recomendada**: para o contrato Core v1 (Fase 20), expor
  `pms_reservation_mappings` como a fonte de ID externo (mais expressiva,
  suporta múltiplos provedores), tratando os campos planos em
  `reservations` como legado a não depender. Corrigir
  `reservation_phone_logs` antes de qualquer exposição de histórico de
  telefone via API (Fase 31, mas priorizável antes se a API do Admin for
  tocar esse dado).

---

## GUEST (hóspede)

- **Fonte oficial**: Core (`guests` por estadia + `guest_persons` como
  identidade mestra cross-reserva).
- **Tabelas**: `guests` (PK `id`, FK obrigatória `reservation_id`, ~85
  colunas — registro por estadia, não por pessoa) e `guest_persons` (PK
  `id`, sem FK de saída — nó de identidade raiz, **retrofitada em
  18/07/2026**, ~2.5 meses depois do schema fundação, evidenciando que a
  deduplicação de hóspedes foi adicionada depois, não desenhada desde o
  início) + `guest_person_change_log`, `guest_person_reuse_decisions`
  (trilha de auditoria de decisões "é a mesma pessoa?").
- **IDs externos**: `guests.external_client_id` (sem coluna `provider`
  ao lado, ao contrário de reservations — UNCONFIRMED qual sistema
  popula).
- **Relacionamentos**: `guests.reservation_id→reservations`,
  `guests.guest_person_id→guest_persons`,
  `reservations.guest_person_id→guest_persons` (a reserva também aponta
  direto para a identidade mestra).
- **Quem cria/altera**: admin manual (`manual-guest.functions.ts`);
  revisão de portaria (`guest-portaria-review.functions.ts`:
  aprovar/solicitar correção/recusar); hóspede via RPCs token-gated
  (`submit_web_checkin`, `guests_apply_ocr_result`,
  `public_claim_guest_ocr`, `public_apply_guest_crop`); OCR automático
  (`ocr-document.functions.ts` — **endpoint sem autenticação própria,
  chamável por hóspede não-logado durante o self-check-in**, chama o
  Lovable AI Gateway/modelos Gemini para extrair dado do documento).
- **Quem lê**: portaria, admin hóspedes, guia/check-in (dado próprio via
  token), relatório em PDF ao proprietário (só nome).
- **Integrações dependentes**: Lovable AI Gateway (OCR via LLM de
  visão, não um serviço de OCR dedicado — vale registrar como escolha de
  arquitetura, não como bug).
- **RLS**: habilitada em `guests` (endurecida 24/07/2026, mesma
  narrativa que `properties`/`reservations`: `guests_staff_all`→
  `guests_admin_manager_all`, `is_op_manager`). `guest_persons` foi criada
  já ampla (`is_staff`) e **endurecida 4 dias depois**
  (`20260722200222_...sql`) para um papel ainda mais restrito,
  `is_internal_staff()` (exclui explicitamente proprietário/portal),
  com DELETE restrito a admin puro. Nenhuma policy `anon` em nenhuma das
  duas — todo acesso de hóspede é via RPC token-gated. Storage: bucket
  `web-checkin` (fotos de documento/selfie) tem policy `anon` mas
  **escopada por pasta = token de check-in válido**
  (`is_valid_checkin_token`), não é acesso público靠 irrestrito.
- **PII**: **a superfície de PII mais sensível dos 4 domínios** — nome
  completo, data de nascimento, documento de identidade completo (número+
  tipo+país), nacionalidade, telefone, e-mail, foto de documento
  (frente/verso), foto de selfie, CPF (em `guest_persons`), e a resposta
  bruta do modelo de OCR (`ocr_raw`, jsonb — risco de retenção excessiva,
  pode conter mais do que os campos extraídos).
- **Risco**: alto — volume de PII + endpoint de OCR sem autenticação
  própria (ainda que gated por token de reserva) + resposta de LLM
  bruta retida sem TTL/expurgo conhecido.
- **Duplicidades**: nenhuma tabela competindo diretamente — o próprio
  sistema já tem uma camada de dedup deliberada (`guest_persons` +
  `guest_person_reuse_decisions`), é um padrão maduro, não um problema.
- **Problemas conhecidos**: retenção de `ocr_raw` sem política de expurgo
  conhecida; endpoint de OCR sem autenticação própria (mitigado por
  exigir token de reserva válido para os passos que persistem dado, mas
  a chamada de extração em si roda antes dessa gate — não confirmado se
  há uma trava equivalente a `assertInboundReadOnlyEndpoint` do domínio
  de mensagens).
- **Ação recomendada**: a Fase 20 (contrato Core v1) **não deve expor
  Guest de forma alguma** ainda — é o domínio de maior risco de PII e não
  está na lista de entidades do v1 (`health`/`properties`/
  `condominiums`/`reservations`/`guests` — nota: o prompt mestre original
  cita "guests" no v1, mas dado o volume de PII e o achado de retenção de
  `ocr_raw`, recomenda-se que a API do Core v1 exponha só um subconjunto
  mínimo de campos de hóspede (nome, tipo, contagem) e nunca documento/
  selfie/OCR bruto, e que isso seja uma decisão explícita, não uma
  omissão silenciosa).

---

## OWNER / CONTRACT / FINANCIAL (proprietário/contrato/financeiro)

Ver detalhamento completo em `docs/STAYO_SOURCE_OF_TRUTH.md` (tabela de
decisão por entidade). Resumo dos campos fixos:

- **Fonte oficial**: Core (`owners`, `owner_contracts`,
  `property_commercial_terms`, `finance_owner_settlements` e satélites).
- **Tabelas/PK**: ver tabela detalhada no documento de fonte da verdade.
- **RLS**: habilitada em todas, com portal de login do próprio
  proprietário via `owners.user_id`/`owner_contracts.owner_user_id`.
- **PII**: documento (CPF/CNPJ), dados bancários/PIX, endereço completo —
  alto.
- **Duplicidades**: confirmadas contra o modelo do Admin (Owner,
  Contrato, Condições Comerciais, convite de auto-cadastro) — o Admin
  deve tratar seu próprio schema como pré-Core/staging, nunca como fonte
  final, conforme decisão explícita já registrada.
- **Ação recomendada**: decisão explícita necessária antes da Fase 22
  (ver seção final de `docs/STAYO_SOURCE_OF_TRUTH.md`) sobre como a
  conversão escreve de volta no Core.

---

## MESSAGES (mensagens/WhatsApp/Ayrton/Condfy)

Ver detalhamento completo em `docs/STAYO_INTEGRATION_RISK_MAP.md`,
explicitamente marcado **RISCO ALTO** pelo prompt mestre. Resumo:

- **Fonte oficial**: Core (`pms_conversations`/`pms_messages` para o
  caminho novo Ayrton; `whatsapp_conversations` legado para BTZap/Wapi —
  os dois coexistem, não unificados).
- **RLS/segurança**: idempotência real e verificada (não é lacuna
  aberta); segredo único compartilhado para a frota de workers Condfy
  (risco modesto); nenhum caminho de código hoje pode disparar envio
  real via Ayrton (dupla trava); envio real via WhatsApp existe e tem um
  bypass manual intencional (`isManualForceException`).
- **Duplicidades/riscos**: schema do banco já divergiu do histórico git
  de `main` (tabelas `condfy_invites`/etc. sem migration correspondente).
- **Ação recomendada**: o Admin só pode consumir mensagens em modo
  leitura (Fase 26), replicando a mesma dupla trava de somente-leitura
  que o próprio Core já usa no worker de entrada Ayrton — nunca assumir
  que "só ler" é seguro por padrão sem essa mesma proteção explícita.

---

## Nota metodológica final

854 migrations não foram lidas exaustivamente arquivo por arquivo —
`CREATE TABLE`/`CREATE POLICY` foram extraídos programaticamente e
cruzados com `types.ts` (schema atual gerado). Tudo que não está listado
acima foi ativamente procurado e está marcado "NOT FOUND"/"UNCONFIRMED"
nos relatórios brutos dos subagentes, nunca omitido silenciosamente.
Nenhuma consulta ao banco real foi feita em nenhum momento desta
auditoria — toda alegação de RLS é a última policy encontrada em
migration, não uma verificação ao vivo contra o Postgres.
