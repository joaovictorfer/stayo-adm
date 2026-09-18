# Fonte da verdade — Stayo Core (STAYO.APP) vs. Stayo Admin

Fase 19 do prompt mestre "STAYO CORE + STAYO ADMIN OPERACIONAL". Este
documento resolve, com evidência de código (não suposição), qual sistema é
a fonte oficial de cada entidade de negócio compartilhada entre os dois
repositórios: `joaovictorfer/stayoapp` (STAYO.APP — daqui em diante "Core")
e `joaovictorfer/stayo-adm` ("Admin").

Método: auditoria estática de código (migrations, `types.ts` gerado pelo
Supabase, rotas, funções, docs internos do próprio Core) rodada por
subagentes desta sessão contra o clone real de `stayoapp`
(`/home/user/stayoapp`, 854 migrations, HEAD `305e4f8`). **Nenhuma consulta
ao banco real foi feita** — nem do lado Core, nem cruzando com o Admin.
Toda alegação abaixo cita arquivo/migration; o que não pôde ser confirmado
está marcado "UNCONFIRMED" ou "NOT FOUND", nunca inventado.

## Veredito central

A premissa do prompt mestre original — de que o Core "ainda não tem"
conceito de Proprietário/Contrato/Condições comerciais/Implantação — está
**errada**. O Core já tem um sistema de Proprietário/Contrato/Financeiro
maduro, ativamente mantido (commits de planejamento datados até
17-24/09/2026, ou seja, dias antes desta auditoria), com RLS, portal do
proprietário próprio, e uma frase textual do próprio time do Core
declarando que aquelas tabelas são "canônicas". **O Core deve ser tratado
como fonte oficial para Proprietário, Contrato, Condições Comerciais e
Financeiro/Repasse.** O Admin não deve construir um segundo modelo de
dados para essas entidades — deve consumi-las/projetá-las via o contrato
de API do Core (Fases 20-21), nunca duplicá-las como se fossem
originais.

## Tabela de decisão por entidade

| Entidade | Fonte oficial | Evidência | O que o Admin faz |
|---|---|---|---|
| **Owner/Proprietário** | **Core** (`owners` + `owner_bank_accounts`) | `stayoapp/src/integrations/supabase/types.ts:13493-13680`; RLS `owners_manager_all`; portal-login via `owners.user_id`; view mascarada `owners_public` | Admin nunca cria um Owner "de verdade" — `owner_records` do Admin vira uma projeção/cache, populada via API do Core assim que ela existir (Fase 21-22). Owner criado hoje no Admin (localStorage/Supabase do Admin) é pré-Core, precisa de conversão explícita (Fase 22), nunca sincronização automática silenciosa. |
| **Property↔Owner** | **Core** (`properties.owner_id` legado + `owner_properties` join table moderna) | `stayoapp` migration `20260506041505_...` (FK legado) e `20260517163550_0d9acdd9-...` (`owner_properties`, com trigger de soma de payout ≤100%) | Idem acima — Admin só referencia. |
| **Contract/Contrato de gestão** | **Core** (`owner_contracts` + `contract_versions`/`contract_templates`/`contract_parties`/etc.) | `stayoapp` migration `20260517165951_b2fac112-...`; máquina de estados de 14 estágios (`contract_flow_status`); e-signature; `docs/contracts-stabilization.md` (8 fases, 73 testes passando) | O Admin **não tem** hoje um conceito de "Contrato" formal (só Proposta/condições comerciais locais) — não há conflito direto de tabela, mas qualquer contrato futuro do Admin deve apontar para o Core, nunca recriar o motor de assinatura/versão. |
| **Condições comerciais** | **Core** (`property_commercial_terms`, com `financial_rules` como antecessor histórico) | `stayoapp` migration `20260819225509_dbe6e758-...` — **criada em 19/08/2026, ou seja, mais nova que a suposição do prompt mestre de que isso não existiria**. Versionamento temporal real (`draft→scheduled→active→replaced→cancelled`). | `commercial_term_defaults`/`commercial_terms` do Admin (schema `0004`) precisam ser tratados como **staging/proposta pré-Core**, não como o registro final. Ao converter uma implantação em propriedade real (Fase 22), as condições comerciais devem ser gravadas no Core (`property_commercial_terms`), não apenas ficar no Admin. |
| **Owner self-registration/convite** | **Core** (`owner_data_requests` + rota pública `proprietario.cadastro.$token.tsx`) | `stayoapp` migration `20260706183723_36efd3b3-...`; plano ativo datado 24/08/2026 (`gestão-de-convites-do-proprietário...`) afirmando textualmente *"Nenhum segundo modelo de dados será criado; tudo reaproveita as tabelas e serviços canônicos"* | O fluxo de convite do Admin (`owner_portal_invitations`, RPC `owner_account_link`, Fase 17H) é uma peça **genuinamente nova e sem equivalente direto no Core** para o caso de uso "Admin comercial convida prospect" (ver linha "Proposal" abaixo) — mas se o objetivo for oficializar um proprietário dentro do Core, o convite final de verdade (assinatura de contrato, KYC bancário) deve ocorrer no fluxo do Core, não duplicar `owner_data_requests`. |
| **Proposal/Proposta comercial** | **Admin** (nenhum equivalente encontrado no Core) | Busca extensiva por "proposta"/"proposal" no Core: NOT FOUND como entidade própria — o Core embute termos propostos como campos inline em `owner_data_request_properties` (`proposed_management_percent` etc.), não como um documento de Proposta versionado e assinável como o Admin tem (`proposals`/`proposal_share_links`, schema `0010`) | **Esta é a única peça de todo o domínio comercial onde o Admin genuinamente não duplica nada do Core.** Pode seguir sendo fonte própria do Admin — mas o *resultado* de uma proposta aceita (condições comerciais + vínculo owner↔property) deve ser escrito no Core na conversão (Fase 22), não ficar paralelo para sempre. |
| **Implantação (Admin) vs. `implantations` (Core)** | **Conceitos diferentes, mesmo nome — colisão de nomenclatura, não de dado** | Core: `stayoapp` migration `20260509055814_a5368ceb-...` — checklist operacional de mobília/fotos de um imóvel já ativo. Admin: funil comercial prospect→proposta→proprietário ativo (schema `0009`) | Não são a mesma tabela, então não há duplicação técnica — mas **o termo precisa ser desambiguado** em qualquer documentação/API cruzando os dois sistemas (ex.: nomear a API do Core como `core.property_setup` internamente, nunca `implantation`, para evitar que o time confunda com o funil comercial do Admin). |
| **Financeiro/Fatura/Repasse** | **Core** (`property_documents`, `finance_owner_settlements`, `finance_closings`, `expenses`, etc.) | Múltiplas migrations do Core, mantidas ativamente (planos datados 13-25/08/2026) | `initial_charges` do Admin (cobrança inicial de implantação — Fase 17J) é uma cobrança **pré-Core**, de setup, não um repasse recorrente — não colide diretamente, mas nenhuma fatura recorrente de aluguel deve nascer no Admin: isso é do Core. |
| **Reservation/Reserva, Guest/Hóspede, Condominium** | **Core** (schema já confirmado: `reservations`, `guests`, `condominiums`) | `stayoapp/src/integrations/supabase/types.ts` linhas 3661/7688/16469/19635 | O Admin não tem hoje nenhum equivalente a essas 3 entidades — sem conflito. Serão consumidas apenas por leitura via API do Core (Fase 20-21). |
| **Messages/Mensagens (WhatsApp/Ayrton)** | **Core**, com ressalvas — ver `docs/STAYO_INTEGRATION_RISK_MAP.md` | `pms_conversations`/`pms_messages`, `outbound_messages` do Admin é só um outbox mock local | O Admin (`outbound_messages`) nunca deve virar um segundo "centro de mensagens" real — é explicitamente vetado pelo prompt mestre. Qualquer leitura de mensagens no Admin deve ser somente-leitura contra o Core (Fase 26), nunca escrever/reenviar. |

## Achado adicional fora do escopo original: divergência schema↔branch no Core

O subagente de auditoria de Mensagens encontrou tabelas totalmente
tipadas em `stayoapp/src/integrations/supabase/types.ts`
(`condfy_invites`, `condfy_api_connections`, `condfy_api_events`,
`condfy_property_mappings`, `condfy_reconciliation_queue`) **sem nenhuma
migration correspondente no diretório `supabase/migrations/` e sem
nenhum código em `src/`/`supabase/functions/` que as referencie**. Isso
indica que migrations rodaram contra o banco compartilhado a partir de uma
branch de feature (`feat/condfy-api-short-stay`, citada em
`.lovable/plan/homologação-condfy-verificação-em-modo-plano-2026-09-14.md`)
sem merge para `main` — ou seja, **o schema real do banco já divergiu do
histórico git de `main`**. Isso é relevante para a Fase 19 porque significa
que **nenhuma auditoria estática deste repositório pode ser tratada como
100% completa** — o types.ts commitado é gerado a partir do banco real e
pode conter mais do que o `main` "sabe". Recomendação: antes de finalizar o
contrato Core v1 (Fase 20), confirmar com o time do Core se essas tabelas
estão em uso real ou são vestígio de uma branch não mesclada.

## O que NÃO foi confirmado (não inventado, marcado como tal)

- Não foi feita nenhuma consulta ao banco real do Core — tudo acima é
  leitura estática de repositório. Qualquer RLS "confirmada" é a última
  policy encontrada nas migrations, não uma verificação ao vivo.
- Não foi confirmado se as tabelas mais recentes de condições comerciais
  (`property_commercial_terms`, 19/08/2026) já têm dados reais povoados ou
  se ainda estão em rollout controlado.
- Não foi encontrada uma rota `admin.contratos.index.tsx` no Core que
  `docs/contracts-stabilization.md` menciona — pode não existir ainda, ou
  existir sob outro nome; marcado UNCONFIRMED pelo subagente.

## Decisão para as Fases 20-22

1. O contrato Core v1 (Fase 20) expõe `properties`, `condominiums`,
   `reservations`, `guests` como planejado — sem mudança, nenhum conflito
   encontrado.
2. Antes de implementar a conversão Implantação→Propriedade/Proprietário
   (Fase 22), é necessário **decidir explicitamente** (com o usuário, não
   por suposição) se o Admin deve: (a) escrever owner/contrato/condições
   comerciais diretamente nas tabelas do Core na conversão, via uma rota
   de escrita dedicada e auditada do Core (exige uma API de escrita que o
   prompt mestre originalmente não previa para o v1, que era read-only);
   ou (b) manter o Admin como um funil comercial pré-Core que gera um
   "pacote de conversão" para um humano aplicar manualmente dentro do
   Core. Esta é uma decisão arquitetural real de fonte-de-verdade, não um
   detalhe de implementação — sinalizada aqui para decisão explícita antes
   da Fase 22, não implementada silenciosamente.
