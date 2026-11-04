# Fase 2A — preparação do STAYO Admin

## Resultado e limites

Consumidor e demonstrativo preparados em modo desativado, com fixtures isoladas. Nenhuma credencial emitida/configurada, chamada privada real ao App, migration, importação, sincronização, publicação ou alteração no VF Financeiro ocorreu nesta fase. A exclusão de fichas pertence à tarefa anterior e não integra esta fase.

Não houve primeira conexão autenticada. Homologação externa, consulta de dados reais e validação da interface autenticada não são declaradas concluídas.

## Origem e revisão consultada

Projeto STAYO App, snapshot somente leitura, revisão **c5e2b1e0**. Documentação do provedor de 21/10/2026; OpenAPI `info.version=1.0.0`, envelope `meta.api_version=v1`; homologação externa `not_performed`.

Cópias byte-a-byte em `docs/api/reference/stayo-app-c5e2b1e0/`:

| Arquivo | SHA-256 da referência |
|---|---|
| HANDOFF-STAYO-ADMIN-TRANSFERRABLE.md | ef7801ff589e41cab9e711942c8ae0dce946d24a5143e920763bf1e035b46c8b |
| HANDOFF-STAYO-ADMIN.md | a9afd0cdc93c555091dea426317263823567a7ce3aba8a815129aa1af84ec4f0 |
| openapi-consolidated-v1.json | 0c0e48e2d80934216fdee4b3ab82212a498dd1067fac5f31b76ac88d4b4db695 |

Também consultados somente em leitura: `src/server/api-v1/admin.server.ts`, `admin-http.server.ts`, `src/lib/api-v1/admin-statement.ts`, `finance-model.ts` e testes `admin-1b.test.ts`. Objetos aninhados frouxos do statement foram projetados conforme handoffs e implementação real, não reconstruídos do chat.

## Contratos efetivamente conferidos

Base `https://guia.stayogramado.com.br/api/v1`. GET `/system/whoami`, `/admin/properties`, `/admin/properties/{id}`, `/admin/owners`, `/admin/owners/{id}`, `/admin/reservations`, `/admin/reservations/{id}`, `/admin/reservations/{id}/statement`, `/admin/reservations/{id}/checkin`.

Envelope `{data,meta}`; listas `{data:{items,page},meta}`; página `limit,count,has_more,next_cursor`. `limit` 1–100, padrão do provedor 50; o cliente mantém limite conservador 10. Cursor opaco e `updated_since`; reservas aceitam `property_id,owner_id,channel,status,checkin_from,checkin_to,include_blocks`. Filtros não autorizam tenant.

Montantes do demonstrativo: centavos inteiros seguros ou null, moeda BRL, `origin`, `source`, `reliability`. Null não vira zero. Origem e confiabilidade permanecem independentes. Sem recebível, `finance.status=unavailable` e montantes null.

Comportamento efetivo prevalece sobre divergência documental:
- Sem autenticação válida: 401.
- Sem `admin:read`: 403, inclusive quando existe outro escopo.
- `admin:read` sem `admin:sensitive`: operação sem CPF.
- Ambos: documento somente de titular único, disponível e válido, e com autorização local adicional.

OpenAPI de whoami omite `admin:sensitive` no enum; declaração Bearer não codifica escopos cumulativos. Não se usa esse enum incompleto como prova de autorização. Provedor deve corrigir documentação e homologar comportamento externamente.

## Correspondência App → Admin e módulos reutilizados

| App | Admin / uso |
|---|---|
| property.id | implementation_projects.core_property_id; Property.id no Core apenas após prova de origem |
| owner.id | owner_records.core_owner_id e implementation_projects.core_owner_id |
| vínculo atual owner/property | implementation_projects.owner_id → owner_records.id; divergência bloqueia |
| coproprietários locais | implementation_owners.implementation_id/owner_id; mapeados, não usados para presumir titular histórico |
| conta Portal | owner_portal_accounts.id/owner_id/role; conta não autoriza automaticamente dados administrativos ou CPF de hóspede |
| reservation.id | parâmetro UUID da leitura; Reservation.id local não é presumido como ID externo verificado |
| reservation.property_id | exige correspondência exata com core_property_id |
| statement.finance.*.cents | linhas do demonstrativo, sem recálculo ou aplicação de percentuais |
| owners_basis | cadastro atual, sem rateio histórico presumido |
| owner_economic_value | parcela econômica, jamais repasse confirmado |

Reservas reutilizam `src/routes/reservas.$id.tsx`, `src/lib/api/queries.ts`, `core-client.ts`, `src/types/core.ts`. Imóveis/proprietários mantêm suas fichas e registros. BI/financeiro/repasse permanecem locais: o demonstrativo é exibido na reserva, sem converter parcela econômica em payout. Portal `portal.inicio.tsx`, `OwnerDashboard` e `owner-permissions.ts` foram mapeados; **não recebem respostas administrativas nesta fase**. Não foram substituídos seus dados atuais por fixtures.

O novo painel apresenta reserva, imóvel, datas, titular sem documento, componentes financeiros, fontes, confiabilidade, avisos e atualização. Não cria tela pública nem tabela espelho do App.

## Segurança e desativação

`STAYO_API_URL` tem base oficial como padrão. `STAYO_API_TOKEN` é lido somente no handler protegido; não configurado por esta entrega. Ausência retorna “Integração ainda não configurada” antes de qualquer consulta privada.

Mesmo se houver configuração, os handlers permanecem desativados nesta fase; nenhuma variável de ambiente ativa homologação silenciosamente. Diagnóstico não faz whoami real; botão de conexão desabilitado. Somente testes com fetch injetado exercitam o consumidor.

Leitura de demonstrativo usa sessão real, `has_admin_role`, consultas RLS ao projeto/proprietário e revalidação antes de responder. Falhas de autorização não são listas vazias. CPF possui helper server-only isolado e **nenhum endpoint geral, URL pública ou RPC do Portal**. `sensitiveAllowed` do handler atual é false: finalidade de CPF ainda deve ser aprovada. IDs de proprietário não são aceitos do navegador.

Antes de um CPF, confirma-se também a associação atual do proprietário no statement do provedor. Reserva sem propriedade, vínculo ausente/duplicado/divergente ou não ativo bloqueia. Revogação revalidada após a leitura. Titular ausente, múltiplo, documento inválido/não CPF são estados distintos. Dados administrativos não são usados como autorização de proprietário. Não há cache de documento, persistência de payload nem logs de identidades/valores/documentos.

## Atualização, erros e resiliência

Reconsulta por IDs conhecidos, independentemente da data da reserva. Mudança de documento sem mudança na reserva e correção financeira antiga são testadas. Nenhum checkpoint financeiro avança autorização ou cobertura de CPF.

Não existe garantia de sincronização completa: `reservations.updated_at` e janela de check-in não cobrem hóspedes, vínculos, exclusões nem todas as correções. Futuramente: reconciliação paginada ou feed completo com tombstones, cursores por recurso e checkpoint apenas após rodada completa. Nenhum polling/job/evento foi ativado.

GET com prazo por tentativa/total, até 3 tentativas elegíveis para rede/timeout/429/5xx; Retry-After respeitado com teto operacional. 401/403/404 não repetem. Redirect é manual e recusado, compatível com runtime do projeto. Erros jamais viram zero, cancelamento ou exclusão. Falhas não devolvem corpo bruto do provedor.

## Arquivos criados/alterados

- Referências oficiais acima; este relatório.
- `src/lib/stayo-central/provider-contracts.ts`: projeções oficiais.
- `statement.ts`: contrato aninhado e apresentação fiel.
- `access.ts`: gate local e titular restrito.
- `consumer.server.ts`: adaptador read-only, desativação e revalidação.
- `reads.functions.ts`: wrapper protegido, sem CPF exposto.
- `contracts.ts`, `http.server.ts`, `central.functions.ts`: erros, configuração e desativação.
- `CentralStatementPanel.tsx`, `CentralApiDiagnostics.tsx`, `reservas.$id.tsx`: relatório e estado desativado.
- `http.test.ts`, `consumer.test.ts`, `fixtures.test-support.ts`: testes sintéticos.
- `AGENTS.md`, `roadmap.md`: limites arquiteturais e tarefa.

## Validação

Comando: `bunx vitest run src/lib/stayo-central/http.test.ts src/lib/stayo-central/consumer.test.ts src/lib/owner-permissions.test.ts`.

68 testes isolados: 37 transporte/contratos/mapeamento, 25 consumidor/valores/autorização, 6 permissões existentes. Verificação inicial detectou fixture com `meta.api_version` incorreto e foi corrigida conforme OpenAPI real; todos passaram na rodada final. Projeções removem campos desconhecidos e fixtures não aparecem como dados reais.

TypeScript e build: verificações automáticas do projeto; último resultado consultado `build OK`. Não executados manualmente.

Playwright: URL direta sem sessão redirecionou para `/login`, nenhum documento exposto, zero chamadas de navegador ao App, zero erros de execução, sem overflow a 390px. **Verificação autenticada da nova interface não realizada**: nenhuma sessão local disponível; não foi emitido token, respeitando a fase. Portanto não há alegação de fluxo real autenticado ponta a ponta.

## Pendências e primeira conexão futura

Provedor: corrigir enum/scopes e completar objetos OpenAPI; homologar autenticação, null/zero e titular; oferecer cobertura de atualizações/vínculos/exclusões e política de limites. Consumidor: finalidade/ação local de CPF, tratamento de coproprietários via relações reais se essa capacidade for autorizada, validação autenticada visual e vínculo explícito de IDs locais de reserva. Sem isso, acessos permanecem restritos.

Após **autorização específica**: receber credencial temporária exclusiva por formulário seguro, prazo/revogação definidos; validar aplicação e escopos via whoami; homologar um imóvel/reserva com UUID previamente conferido; testar 401/403, read sem CPF, sensitive com autorização local, acesso cruzado e revogação; demonstrativo preservando cents/origens; corrigir pendências, registrar somente metadados. Ativar apenas consultas homologadas em mudança revisada. Não iniciar importação/sync/jobs nem publicação sem autorização separada.