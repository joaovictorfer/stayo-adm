# Relatório Final — Central Comercial e de Onboarding do Proprietário

Fecha o plano de 15 fases (Fase 0 → Fase 15) que evoluiu o Stayo Admin de
um shell para uma central que acompanha a relação com o proprietário desde
o primeiro contato até a cobrança inicial, preparada para a futura
conversão em Property/Owner oficiais do Stayo Core.

## O que foi construído, fase a fase

| Fase | O que entrega                                                                                                   | Doc                                    |
| ---- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 0    | Auditoria completa do estado anterior — 12 divergências reais encontradas, todas corrigidas nas fases seguintes | `OWNER_IMPLEMENTATION_AUDIT.md`        |
| 1    | Fundação: `AdminApiClient`, papéis (`admin_role`), auditoria (`audit_logs`), feature flag Supabase              | `OWNER_IMPLEMENTATION_ARCHITECTURE.md` |
| 2    | Proprietário como entidade real (`owner_records`), dedupe por telefone                                          | `OWNER_IMPLEMENTATION_ARCHITECTURE.md` |
| 3    | Pré-imóvel e implantação, código `IMP-00001` gerado no servidor                                                 | `IMPLEMENTATION_WORKFLOW.md`           |
| 4    | Condições comerciais configuráveis (defaults + snapshot por implantação)                                        | `COMMERCIAL_TERMS.md`                  |
| 5    | Progresso × prontidão separados; override formal de item pulado                                                 | `IMPLEMENTATION_WORKFLOW.md`           |
| 6    | Proposta versionada de verdade; link público fixo por versão (bug real corrigido)                               | `PROPOSALS.md`                         |
| 7    | PDF real da proposta (`pdf-lib`, compatível com Cloudflare Workers)                                             | `PROPOSALS.md`                         |
| 8    | Convite do portal seguro: hash, expiração, revogação                                                            | `OWNER_ONBOARDING_ARCHITECTURE.md`     |
| 9    | WhatsApp: gateway + outbox auditável, envio sempre manual (`wa.me`)                                             | `WHATSAPP_OUTBOX.md`                   |
| 10   | Cobrança inicial nasce do aceite da proposta, idempotente                                                       | `INITIAL_CHARGES.md`                   |
| 11   | Stub de conversão para o Core — nunca fabrica IDs, flag desligada                                               | `CORE_CONVERSION.md`                   |
| 12   | Funil visual + filtros de responsável/período/prontidão; passe mobile                                           | `IMPLEMENTATION_WORKFLOW.md`           |
| 13   | Mapa completo do localStorage + importador real para 5 tabelas                                                  | `LOCALSTORAGE_MIGRATION.md`            |
| 14   | QA final: typecheck/lint/test/build limpos, sem segredo no bundle, cenário de aceite ponta a ponta validado     | esta seção                             |
| 15   | Este relatório + os 8 docs de tópico listados acima                                                             | —                                      |

`OWNER_PORTAL.md` documenta as duas telas públicas (convite e proposta)
que atravessam várias dessas fases.

## Cenário de aceite ponta a ponta (Fase 14)

Validado via Playwright contra o app rodando de verdade (não é teste de
unidade): captura rápida do prospect (nome+telefone) → código `IMP-xxxxx`
gerado → condição comercial conferida → checklist abre → proposta v1
salva → link gerado → PDF baixado → aceite feito numa aba separada →
cobrança inicial nasce pendente → versão 2 criada **sem** alterar o que o
link da v1 mostra → uma segunda aba (mesma origem) enxerga a cobrança sem
recarregar manualmente → WhatsApp só oferece link `wa.me` público, nunca
uma chamada de envio real. Todos os pontos passaram.

Também: `bunx tsc --noEmit`, `eslint`, `vitest run` (27 testes) e
`vite build` limpos; nenhum `service_role` ou segredo no bundle público
(`.output/public/assets/*.js`); crawl das 40 rotas (top-level + detalhe)
sem erro de console/página. CI (`ci.yml`) verde em toda fase deste plano —
histórico completo na pull request.

## O que continua bloqueado por credencial externa (documentado, não bloqueia o resto)

- **Projeto Supabase real** — todo o app roda no adapter local
  (localStorage) até existir `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.
  Cinco verticais (`owner_records`, `commercial_term_defaults`,
  `commercial_terms`, `outbound_messages`, `initial_charges`) já têm
  adapter Supabase pronto e importador (`docs/LOCALSTORAGE_MIGRATION.md`).
  Seis chaves ainda não (`owner-onboarding-links/submissions`,
  `proposals`, `proposal-share-links`, `owner-notes`,
  `checklist-templates`, `implementations`/`implementation-items`) — mapa
  completo, com o motivo de cada uma, no mesmo documento.
- **`audit_logs` não entra no importador** — a RLS exige
  `actor_id = auth.uid()`, e todo evento local tem ator nulo (sem auth
  real ainda). Migrar esse histórico específico precisa de um script
  `service_role` fora do browser — decisão de segurança, não uma
  limitação a contornar.
- **Endpoint de escrita do Core** — não existe ainda, então
  `CoreConversionService.createOwner/createProperty/linkImplementation`
  são stubs que sempre lançam (`docs/CORE_CONVERSION.md`). Nenhuma
  implantação foi convertida de verdade neste ambiente, por design.
- **Provider de WhatsApp real** — mock ativo por padrão; o envio de
  verdade continua manual via `wa.me` até um provider existir
  (`docs/WHATSAPP_OUTBOX.md`).
- **Assinatura eletrônica / certificação de aceite** — fora de escopo
  deste plano; o aceite hoje é registro auditável simples, explicitamente
  não uma assinatura jurídica.
- **Multi-dispositivo real** — architeturalmente pronto (token por hash,
  link fixo por versão, idempotência por chave natural) em toda vertical
  que já tem adapter Supabase; nas que ainda não têm, "outro dispositivo"
  só existe de fato quando essas tabelas existirem.

## Regras do plano master que seguem valendo daqui para frente

Nunca inventar dado de Core/Property antes da conversão real; nunca
persistir segredo em `VITE_*`; nunca fingir envio de WhatsApp; nunca pular
RLS; nunca tratar esconder botão como controle de acesso; nunca sobrescrever
uma proposta aceita; sempre buscar antes de criar Owner/Property oficial.
Todas seguem codificadas em código e reforçadas nos docs de tópico —
qualquer fase futura que violar uma delas está desviando do que este plano
estabeleceu.
