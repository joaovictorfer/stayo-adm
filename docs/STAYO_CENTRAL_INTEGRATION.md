# API Central STAYO — Fase 10B.2

## A. Diagnóstico atual / B. correspondência

Consultar [matriz prévia](STAYO_CENTRAL_MAPPING.md). O backend do Admin é Lovable Cloud, independente do STAYO App. Não há pressuposto de base compartilhada. Recursos operacionais das queries existentes continuam mockados; implantações e cadastros comerciais continuam nos adapters existentes. Não foi criado proprietário, imóvel, reserva ou contrato.

## C. Cliente / D. consultas preparadas

Base fixa: `https://guia.stayogramado.com.br/api/v1`. Aplicação esperada `stayo-admin`, escopo solicitado `admin:read`.

`src/lib/stayo-central/http.server.ts`: somente GET, Bearer server-only, timeout 15s incluindo leitura do corpo e teto total de 50s por GET, `redirect:error`, no-store, allowlist de endpoints, retries no máximo 3 tentativas. 401/403 interrompem; 429 respeita Retry-After e backoff exponencial com jitter; esperas longas devolvem pendência; 5xx/network/timeout têm retries limitados. Logs opcionais só endpoint sem UUID, status, tentativa, request ID e classificação; nunca token, Authorization, query de negócio ou resposta pessoal. Infraestrutura externa deve omitir query strings (inclusive cursor) de logs; a integração local não registra queries.

Preparados: `/admin/properties`, `/admin/properties/{id}`, `/admin/owners`, `/admin/owners/{id}`, `/admin/reservations`, `/admin/reservations/{id}`, `/admin/reservations/{id}/checkin`, `/system/whoami`. Paginação sequencial completa com `next_cursor`, `has_more`, limite de proteção, detecção de cursor/UUID repetido. Filtros validados por recurso. Não existem consultas de financeiro, contratos PDF ou operações de escrita; não preparar campos ausentes na documentação.

**Bloqueio contratual explícito:** o handoff descreve endpoints, mas não contém os schemas completos do OpenAPI citado. URLs consultadas para os arquivos retornaram 404; o arquivo não está neste projeto. Os schemas implementados são envelopes e projeções mínimas garantidas pelo handoff, não contratos completos homologados. Propriedade/proprietário: somente referência UUID; reserva: exemplo parcial literal; Web Check-in: apenas request UUID, sem inventar response; whoami: envelope de transporte, sem supor nomes internos da app/scopes. Consultas de negócio permanecem bloqueadas por `contract_pending`, mesmo que um token seja futuramente configurado. whoami HTTP 200 isolado NÃO declara identidade/escopo corretos ou operação homologada.

## E. Estruturas

- `contracts.ts`: schemas mínimos, filtros e DTOs de falha seguros.
- `http.server.ts`: transporte exclusivamente de servidor, sem acesso ao banco provedor.
- `mapping.ts`: correspondência pura UUID + divergências e cálculo de overlap.
- `central.functions.ts`: funções protegidas por sessão e `has_admin_role(super_admin,admin)`.
- `CentralApiDiagnostics.tsx`: seção discreta na área existente Configurações → Stayo Core → API Central V1.
- `stayo_central_diagnostics`: metadados operacionais de consultas manuais; sem payload, contatos ou token; RLS admin e actor=auth.uid.
- `stayo_central_checkpoints`: preparação aditiva de checkpoint durável; sem rows seeded, sem grants de escrita authenticated, sem rotina para avançar neste estágio.

A estrutura técnica justifica-se pela necessidade de manter data/status da última consulta sem armazenar dados pessoais e de não depender de memória volátil entre execuções. Não existe staging comercial nem tabela duplicada de cadastro.

## F. Autenticação

Secret privado solicitado pelo usuário: `STAYO_API_TOKEN`. Ainda não emitido/configurado; aplicação provedora permanece inativa conforme handoff. Não solicitar nem gerar valor nesta fase. Configuração comum `STAYO_API_URL` pode conter somente a base oficial; na ausência usa constante oficial. O handoff também denomina `STAYO_API_BASE_URL`; nesta implementação o nome canônico é o solicitado `STAYO_API_URL`, evitando ambiguidade. Nunca `VITE_*` para credencial e nunca token como parâmetro do usuário. Quando houver emissão autorizada, cadastrar pelo formulário seguro de secrets e republicar antes de esperar uso na versão publicada.

Sem token: diagnóstico mostra pendente e não envia request privado. Carregamento do Admin, login e fluxos atuais não dependem da API.

## G. Testes / H. compatibilidade

Fixtures são sintéticas; nenhuma credencial real ou dado de pessoa real. Testes cobrem origem/headers/timeout/redirect, falta de token, 401/403, 5xx, rede, timeout, 429 segundos/data, paginação, duplicidade, campos opcionais, referência UUID imóvel/proprietário, reserva parcial, request de check-in, bloqueio ocultando nome, logs sem payload, correspondência e não mutação local, overlap. As fixtures mínimas não substituem testes contra o OpenAPI completo — estes permanecem pendentes.

Queries/adapters operacionais, cadastro/implantação/portal/financeiro/VF não foram substituídos. O diagnóstico não envia dados administrativos ao Portal ou Website. `admin:read` é escopo da aplicação, não permissão por proprietário; qualquer futuro Portal exige DTO proprietário com autorização independente.

## I. Pendências / J. homologação real

1. Obter arquivo integral `openapi-consolidated-v1.json`, `v1-inventario.md` e `v1-events.md` do responsável pelo App; versionar localmente e implementar schemas reais/fixtures completas, especialmente whoami e check-in.
2. Identificar responsável do consumidor; autorização explícita para ativar app e emissor emitir token temporário mínimo `admin:read` com expiração. Não há REST/UI de emissão no contrato atual.
3. Cadastrar token seguro; validar whoami 200 com app e escopo exatos. No-token 401 já observado, mas não prova autenticação privada.
4. Consultar fixtures autorizadas: imóveis/proprietários/reserva/check-in, primeira página limit=10 e todas páginas; testar escopo financeiro 403 e token revogado 401. Não usar dados pessoais reais como fixtures.
5. Apresentar correspondências UUID e divergências antes de qualquer importação; decidir autoridade e relações N:N. Nenhuma criação/fusão automática.
6. Homologar revogação/rotação: emitir novo, trocar secret, validar identidade, revogar anterior; parar consultas em 401/403. Remover secret após revogação final.
7. Sincronização futura: início de rodada durável, overlap 5 minutos a partir do início da última rodada COMPLETA, cursor específico de recurso/filtro, rescan completo periódico; ausência de row não é exclusão. Relações/contratos podem mudar sem updated_at principal. Último snapshot válido só pode ser substituído após transação completa.
8. Eventos/inbox/ACK continuam off. Não cron, worker, webhook ou ACK nesta fase; ativação depende de autorização separada e teste PostgreSQL multi-sessão.

## K. operações de escrita futuras

Consultar modelo de autoridade na matriz. POST/PATCH de proprietário/imóvel, relações N:N, contrato/assinaturas, percentuais, financeiro e revisão de check-in exigirão endpoints/esquemas/escopos específicos do provedor. Não existe permissão para acesso direto ao banco do App nem API alternativa.

## Evidência pública

Consulta read-only em 21/10/2026: `/health` HTTP 200 com `{data:{status:"ok"},meta:{api_version:"v1",request_id:...}}`; `/system/whoami` sem token HTTP 401 com erro `unauthorized` e envelope V1. Health não garante todas fontes. Nenhuma homologação autenticada foi executada.