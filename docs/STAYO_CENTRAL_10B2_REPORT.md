# Relatório Fase 10B.2

## A–B. Auditoria e matriz
Admin usa Lovable Cloud própria; App é provedor independente. Foram identificados `owner_records`, `implementation_projects`, `implementation_owners`, propostas, condições, anexos, contas do Portal e vínculos externos `core_owner_id`/`core_property_id`. Não há tabela local operacional de reservas/imóveis oficiais/contratos neste escopo. A matriz anterior à sincronização está em `STAYO_CENTRAL_MAPPING.md`.

Conferência read-only: 32 proprietários, 12 implantações e 16 propostas, sem alteração antes/depois. Diagnóstico identifica referências conhecidas por UUID, vínculos ausentes/ambíguos e divergência owner/ficha; nenhuma fusão por nome/e-mail/CPF. Timestamp da origem fica desconhecido, não inventado, até receber schema oficial.

## C–E. Implementação
Cliente server-only para base oficial, Bearer, timeout incluindo body, teto de tentativas/tempo, no redirects, 401/403 sem retry, 429/5xx tratados, allowlist GET, paginação e filtros. Funções protegidas exclusivamente admin/super_admin. Diagnóstico na área existente Stayo Core. Tabelas técnicas aditivas com GRANT/RLS: diagnóstico sem payload e checkpoint preparado sem escritor ativo. Sem importação, deletes, cron, worker, eventos, ACK ou acesso ao banco do App.

Arquivos: `src/lib/stayo-central/{contracts.ts,http.server.ts,mapping.ts,central.functions.ts,http.test.ts,AGENTS.md}`, `src/components/admin/CentralApiDiagnostics.tsx`, ajustes em `configuracoes.stayo-core.tsx`, migração gerada `0073_central_api_diagnostics.sql`, documentação de matriz/integração/relatório, roadmap e regras arquiteturais.

## F. Autenticação
STAYO_API_TOKEN não configurado; não foi emitido nem solicitado. Estado pendente, botão de teste desativado. App provedora inativa conforme handoff. Saúde pública observada HTTP 200; whoami anônimo HTTP 401 V1. **Não houve homologação privada.** Mesmo futuro HTTP 200 de whoami não provará app/escopo até o schema completo ser validado.

## G–H. Validação
46 testes selecionados passaram: 35 transporte/mapeamento/contratos mínimos, 11 regressão auth/permissões/local store. Build/typecheck da plataforma: OK. Playwright autenticado validou diagnóstico pendente em desktop/celular, teste desabilitado, acesso à implantação preservado, zero erros de runtime. Sessão ausente manteve redirecionamento ao login. Banco confirmou estruturas/policies; cadastros produtivos e propostas preservados. Nenhum secret foi exposto ao navegador.

## I–J. Pendências e homologação
**Preparação parcial segura, não conclusão contratual integral:** falta o arquivo oficial `openapi-consolidated-v1.json` (URLs públicas consultadas 404). Fixtures atuais cobrem projeções mínimas do handoff, não schemas completos de proprietários/imóveis/whoami/check-in. Consultas de negócio bloqueadas por `contract_pending`. Após receber contrato, completar DTOs e testes, validar manualmente identidade `stayo-admin`/`admin:read`, fixture autorizada, paginação, 403 escopo alheio, revogação/rotação e matriz antes de qualquer importação. Procedimento detalhado em `STAYO_CENTRAL_INTEGRATION.md`.

## K. Escritas futuras
POST/PATCH oficiais para proprietários, imóveis, relações, contratos e percentuais; financeiro e revisão check-in precisam endpoints/escopos/controle de versão/auditoria separados. Não disponíveis na V1 atual; nenhuma alternativa direta ao banco autorizada. Fluxos locais seguem inalterados.

## Pedido recebido durante o trabalho
Cobranças Fase 3 (QR Pix dinâmico e checkout cartão +5% server-side) registrada no roadmap; bloqueada pela conexão Pagar.me não concluída. Nenhuma tentativa pagável foi habilitada. Não modificar esta integração para contornar credenciais ausentes.