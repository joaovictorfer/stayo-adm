# STAYO ADMIN — MATRIZ DE SUPERFÍCIE PÚBLICA

> **Fase A / Contenção P0**  
> Data: 23/09/2026  
> Status: **INVENTÁRIO DE CÓDIGO CONCLUÍDO / PROVA NO BANCO BLOQUEADA**

Esta matriz inventaria as superfícies relevantes da frente **Implantação + Proprietário + Portal**, incluindo caminhos atuais, legados, RPCs, RLS, Storage e stores locais. Ela não declara segurança produtiva com base apenas no código versionado.

## 1. Legenda

### Identidades

- `anon` — chave pública sem sessão autenticada.
- `auth sem vínculo` — usuário autenticado que não é owner daquele registro e não possui role interna autorizada.
- `owner correto` — proprietário/coproprietário vinculado à implantação/imóvel correto.
- `owner outro` — proprietário autenticado vinculado a outro imóvel.
- `admin` — perfil interno autorizado.
- `token` — visitante que possui convite/share token.

### Classificação de risco

- **CONFIRMADO** — exposição/efeito reproduzido no ambiente correto ou comportamento determinístico observado no próprio código quando não depende do banco.
- **PERMISSÃO EXCESSIVA, SEM EXPOSIÇÃO REPRODUZIDA** — código/policy versionada concede superfície maior que a necessária, mas o banco produtivo não pôde ser reproduzido.
- **NÃO REPRODUZIDO** — teste executado e exposição não ocorreu.
- **NÃO VERIFICADO** — faltou acesso ao ambiente/identidade necessária.
- **BLOQUEADO** — prova depende do banco correto, indisponível nesta sessão.

## 2. Matriz principal

| Superfície | Consumidor / rota | Identidade | Dados lidos | Dados escritos | Autorização encontrada no repositório | Classificação atual | Compatibilidade / decisão |
|---|---|---|---|---|---|---|---|
| `/portal/implantacao/$token` | `portal.implantacao.$token.tsx` + `OwnerJourney` | `anon` + token | status do convite, proposta, termos, condições; draft/onboarding e detalhes do imóvel nas etapas seguintes | aceite, onboarding, imóvel, vínculo de conta | token via RPCs security-definer; UI bloqueia expirado/revogado | NÃO VERIFICADO no banco | rota atual legítima; não quebrar sem prova |
| `owner_onboarding_resolve_token` | query pública de convite | `anon`, authenticated | implementation_id, expires/used/revoked | acesso/metadata conforme evolução | SECURITY DEFINER; hash SHA-256 no SQL versionado | NÃO VERIFICADO | manter até teste de token válido/expirado/revogado/inexistente |
| `owner_onboarding_submit` / draft RPCs posteriores | jornada pública | `anon` + token | convite e draft próprio | PII, documento, contato, Pix/dados de repasse; marca uso/submissão | revalidação server-side em migrations versionadas | NÃO VERIFICADO | fluxo crítico; qualquer contenção exige manter convites legítimos |
| `owner_journey_resolve_proposal` | `owner-journey.ts` | `anon` + token | versão da proposta, itens, termos, condições contratuais | — | Supabase `0016`: token hash + expiração/revogação + proposal vinculada | NÃO VERIFICADO | `0016` não é prova de aplicação remota |
| `owner_journey_accept_proposal` | `owner-journey.ts` | `anon` + token | proposta vinculada | accepted_at/name, auditoria, cobrança inicial idempotente | SECURITY DEFINER em `0016` | NÃO VERIFICADO | não alterar sem reconciliar dependências de schema |
| `/portal/proposta/$token` | rota pública legada | token de proposal share | proposta/implantação/termos/cobrança conforme queries | aceite no fluxo legado | `proposalShareStore` ainda é local; tabelas Supabase têm RLS versionada | NÃO VERIFICADO | legado precisa de compatibilidade; não remover nesta fase |
| `proposal_share_links` | store/tabela de compartilhamento | staff; token no fluxo legado | vínculo share→proposal | criação/uso conforme adapter | coexistência tabela Supabase + store local | NÃO VERIFICADO | MIGRAR/REMOVER APÓS COMPATIBILIDADE |
| `/portal/previa/$id` | preview interna acessível por URL | sem guard de rota próprio | implantação e owner via query | — | repo espera RLS de `implementation_projects`; rota não autentica por si | NÃO VERIFICADO | superfície desnecessariamente pública por URL; testar anon antes de decidir containment |
| `/portal/inicio` | portal autenticado | owner autenticado | implantação, propostas, tasks, anexos, timeline, property details | property details e ações permitidas | `useOwnerSession` + RLS/RPCs | NÃO VERIFICADO | guard React existe, mas segurança real depende de RLS |
| `owner_portal_accounts` | sessão/vínculo owner | authenticated | conta própria | vínculo via `owner_account_link` | RLS própria conta; RPC de link | NÃO VERIFICADO | testar auth sem vínculo/owner outro |
| `owner_account_link(token)` | pós-signup | authenticated + token | convite/owner_id | cria vínculo auth↔owner | valida auth, hash, expiração/revogação, owner_id | NÃO VERIFICADO | replay/used_at precisa ser testado conforme contrato legítimo |
| `owner_records` | Admin + Portal | staff / owner correto | nome, telefone, e-mail, documento | staff altera; owner não deveria editar direto | RLS versionada: staff e próprio owner SELECT | NÃO VERIFICADO | PII; revisar minimização de colunas |
| `implementation_projects` | Portal `listOwnerImplementations()` | owner autenticado | **`select('*')`**; cliente mapeia inclusive `address` e `notes` | — pelo consumer portal | owner row-policy em Supabase `0013` | **PERMISSÃO EXCESSIVA, SEM EXPOSIÇÃO REPRODUZIDA** | substituir projeção ampla após confirmar DB; `notes` pode ser interno |
| `implementation_property_details` leitura autenticada | Portal `getPropertyDetails()` | owner correto | **`select('*')`**; endereço, acesso, código, Wi-Fi/senha, notes | — | owner SELECT via Drizzle `0008` | **PERMISSÃO EXCESSIVA, SEM EXPOSIÇÃO REPRODUZIDA** | coluna sensível; revisão completa depende do banco |
| `implementation_property_details` escrita autenticada | Portal `savePropertyDetails()` | owner correto | linha própria | upsert de endereço, acesso, código, Wi-Fi/senha, notes | owner INSERT/UPDATE via Drizzle `0008` | **PERMISSÃO EXCESSIVA, SEM EXPOSIÇÃO REPRODUZIDA** | conflita com fluxo futuro de submissão/revisão; não improvisar Fase E |
| `owner_property_details_resolve_by_token` | onboarding público | `anon` + token | endereço, tipologia, acesso, **código e Wi-Fi/senha** | — | token hash + não revogado + não expirado | NÃO VERIFICADO | alto impacto se token vazar; provar replay/expiração no DB real |
| `owner_property_details_save_by_token` | onboarding público | `anon` + token | estado atual após save | escreve campos oficiais inclusive códigos/senhas | SECURITY DEFINER; grant anon/authenticated no Drizzle `0010` | **PERMISSÃO EXCESSIVA, SEM EXPOSIÇÃO REPRODUZIDA** | contenção parcial pode quebrar jornada; deferir até teste/contrato de revisão |
| `owner_onboarding_submissions` | onboarding/admin | token via RPC / staff | PII e dados de repasse | PII/Pix/draft | tabela staff-only; RPC pública | NÃO VERIFICADO | nunca expor valores reais em logs/relatórios |
| `initial_charges` | Admin + owner portal | finance/admin / owner correto | cobrança/valor/status/ref | staff autorizado | owner read policy adicionada em `0013` | NÃO VERIFICADO | dado financeiro; testar owner outro |
| `owner_notes` | central do proprietário no Admin | staff | nota interna livre | staff/local store | SQL versionado não dá policy ao owner; store local persiste | NÃO VERIFICADO | **REMOVER APÓS COMPATIBILIDADE** do local; jamais expor no Portal |
| `owner_tasks` | Portal/Admin | owner correto / staff | pendências próprias | staff gerencia | owner SELECT por vínculo | NÃO VERIFICADO | testar owner outro e sem vínculo |
| `attachments` metadata | Portal/Admin | owner correto / staff | filename/category/path/metadata | admin; upload owner depende das policies disponíveis | owner SELECT próprio; staff ALL no SQL versionado | NÃO VERIFICADO | metadata e Storage precisam ser testados em conjunto |
| bucket `owner-attachments` | `attachments.ts` | owner correto / staff | arquivo privado | owner upload própria pasta; staff | path inicia por owner_id; Storage RLS versionada | NÃO VERIFICADO | testar download/sign de path de outro owner |
| `createSignedUrl(storagePath)` | `getAttachmentSignedUrl` | sessão atual | URL temporária de arquivo | gera signed URL | app não checa owner do path; depende integralmente da Storage RLS | NÃO VERIFICADO | signed URL não é autorização permanente; teste cruzado obrigatório |
| bucket `implementation-covers` | Admin | staff | capa de implantação | staff autorizado | Drizzle `0012` staff-only | NÃO VERIFICADO | confirmar bucket real e policies |
| bucket `supply-documents` | Admin | staff | proposta/fatura/NF/contrato | staff | Drizzle `0014` staff-only | NÃO VERIFICADO | contém documentos financeiros/comerciais |
| `implementation_timeline_updates` | Portal/Admin | owner correto / staff | somente eventos owner_visible esperados | staff cria | owner policy `owner_visible` em Drizzle `0008` | NÃO VERIFICADO | consumer portal seleciona campos específicos; manter |
| `implementation_inspections` | Portal/Admin | owner correto / staff | `public_notes`, datas/status | staff | owner policy `owner_visible` | NÃO VERIFICADO | confirmar que `internal_notes` é inacessível ao owner |
| `portal_content_blocks` tabela interna | Portal/Guest desconhecido | histórico: `anon` | draft + published no mesmo objeto segundo Fonte Mestra | staff | Fonte Mestra registrou policy pública ampla em snapshot anterior | **NÃO VERIFICADO — PRIORIDADE P0** | migration de origem não localizada; não corrigir às cegas |
| eventual projeção pública de conteúdo | consumidor público | `anon` | somente published esperado | — | direção arquitetural, não comprovada no repo/banco | NÃO VERIFICADO | solução preferida se exposição for confirmada: view/RPC explícita sem `SELECT *` |
| quick intake draft | fluxo Nova Implantação | browser local | JSON do formulário | localStorage | nenhuma autorização de backend; é estado do browser | **CONFIRMADO: persistência local existe** | CACHE TEMPORÁRIO; revisar campos sensíveis/retenção |
| `AdminApiClient` fallback | diversos consumers Admin | browser | dados administrativos | localStorage quando Supabase não configurado | decisão automática por env | **CONFIRMADO: fallback existe no código** | pode mascarar ambiente desconectado; remover de produção em fase de persistência |
| importador local→Supabase | `/configuracoes/migracao` / utilitário | admin/browser | snapshot de stores locais | upsert no Supabase | operação explícita do utilitário, RLS do usuário | CONFIRMADO no código; execução produtiva NÃO VERIFICADA | manter como ferramenta de migração controlada, nunca automática |
| import automático de proposals | `proposalsStore.list/get` | admin/browser | proposals locais | pode inserir proposals locais ausentes no Supabase ao ler | `ensureLocalProposalsMigrated()` em caminho normal | **CONFIRMADO NO CÓDIGO; EFEITO PRODUTIVO NÃO REPRODUZIDO** | candidato forte a contenção, mas não editar sem banco/QA porque prompt exige P0 comprovado |

## 3. Stores locais e caminhos legados

| Store/caminho | Leitores/escritores observados | Tipo de dado | Comportamento atual | Classificação de destino |
|---|---|---|---|---|
| proposals locais | `proposalsStore`; telas de proposta/implantação | versões, itens, total, aceite | quando Supabase configurado, store usa banco, mas executa import automático de proposals locais em leituras | **MIGRAR e REMOVER APÓS COMPATIBILIDADE**; eliminar import silencioso após prova |
| `proposalShare` | rota legada `/portal/proposta/$token` e criação de share | token/share link | permanece localStorage; não é multi-browser confiável | **MIGRAR** e depois **REMOVER APÓS COMPATIBILIDADE** |
| checklist templates | telas/configuração de implantação | templates operacionais | store local ainda presente | **MIGRAR** |
| owner notes | ficha administrativa do owner | notas internas | store local ainda presente apesar de tabela versionada | **MIGRAR** e **REMOVER APÓS COMPATIBILIDADE** |
| `AdminApiClient` local adapter | diversos módulos Admin | PII, comercial, cobrança, convites etc. | fallback completo quando env Supabase ausente | **REMOVER DE PRODUÇÃO APÓS COMPATIBILIDADE**; dev/test pode permanecer explícito |
| quick intake draft | criação rápida de implantação | formulário em progresso | JSON arbitrário no localStorage | **CACHE TEMPORÁRIO**, com minimização/expiração futura |
| migration status | tela/utilitário de migração | metadata técnica | marca último import/validate no navegador | **CACHE TEMPORÁRIO** |

### Achado específico pedido pela Fase A

O caminho normal de propostas contém uma função de compatibilidade que pode importar propostas do `localStorage` para o Supabase durante operações de leitura (`ensureLocalProposalsMigrated`). Portanto, **abrir uma tela que lista/busca proposta pode, pelo código, causar escrita remota** se houver dados locais e a sessão tiver permissão.

Isso é um problema de integridade e previsibilidade. Porém, como o banco correto não está acessível, não foi possível demonstrar se este efeito ocorre hoje em produção, quais linhas locais existem ou se a RLS efetivamente permite a inserção. Por isso a execução atual **não removerá o caminho silenciosamente** antes de verificar compatibilidade e dados reais.

## 4. Prova de autorização — estado desta execução

Os testes abaixo são obrigatórios para qualquer superfície alterada. Nesta auditoria, todos os testes que dependem do Supabase correto estão **BLOQUEADOS** porque o conector disponível aponta para outro projeto.

| Caso | Resultado exigido | Resultado desta auditoria |
|---|---|---|
| `anon` acessa tabela interna | negado | BLOQUEADO |
| auth sem vínculo lê owner/implantação | negado | BLOQUEADO |
| owner correto lê próprio escopo | permitido e minimizado | BLOQUEADO |
| owner de outro imóvel tenta leitura | negado | BLOQUEADO |
| owner de outro imóvel tenta escrita | negado | BLOQUEADO |
| admin autorizado lê/edita conforme role | permitido | BLOQUEADO |
| token válido | somente escopo do convite | BLOQUEADO |
| token expirado | negado | BLOQUEADO |
| token revogado | negado | BLOQUEADO |
| token inexistente | negado | BLOQUEADO |
| token reutilizado | conforme contrato explícito, sem escalada/replay indevido | BLOQUEADO |
| signed URL para arquivo do próprio owner | permitido por tempo limitado | BLOQUEADO |
| signed URL para path de outro owner | negado | BLOQUEADO |

Captura de tela ou botão escondido não será aceito como prova de autorização.

## 5. Riscos classificados

### 5.1 `portal_content_blocks`

**Classificação:** **NÃO VERIFICADO — prioridade P0 assim que o DB correto estiver acessível.**

A Fonte Mestra registra exposição histórica potencial: draft e published na mesma tabela com policy pública ampla. O objeto/migration de origem não apareceu nas linhas versionadas auditadas, então a correção não pode ser escrita com segurança sem primeiro consultar o objeto real, grants e consumers.

Se a exposição atual for confirmada, a contenção esperada é:

1. fechar `anon` da tabela interna;
2. criar/usar uma projeção pública explícita apenas de campos publicados;
3. não usar `SELECT *`;
4. provar que o Portal/Guest legítimo continua funcionando;
5. testar allow/deny por API.

### 5.2 `implementation_projects` com `select('*')` no Portal

**Classificação:** **PERMISSÃO EXCESSIVA, SEM EXPOSIÇÃO REPRODUZIDA.**

O consumer autenticado do owner busca linha completa. O tipo atual mapeia `notes`, além de endereço e dados operacionais. Se `notes` tiver conteúdo interno, RLS de linha não evita que ele seja entregue ao proprietário.

**Contenção futura mínima possível:** projeção explícita ou view/RPC owner-safe, após confirmação de schema/consumers.

### 5.3 `implementation_property_details`

**Classificação:** **PERMISSÃO EXCESSIVA, SEM EXPOSIÇÃO REPRODUZIDA.**

O owner autenticado e o token, segundo migrations versionadas, podem escrever diretamente no registro oficial. O mesmo objeto contém código de acesso e credenciais Wi-Fi.

Não será criada uma tabela/arquitetura paralela nesta fase. A solução completa pertence ao fluxo futuro de submissão/revisão. Antes disso, só cabe contenção pontual se o banco real demonstrar um P0 que possa ser fechado sem quebrar a jornada legítima.

### 5.4 `/portal/previa/$id`

**Classificação:** **NÃO VERIFICADO.**

A rota não possui guard próprio e recebe ID diretamente na URL. O repositório sugere que RLS deve bloquear `anon`, mas isso não foi testado no banco correto.

### 5.5 documentos/Storage/signed URLs

**Classificação:** **NÃO VERIFICADO.**

As migrations versionadas são razoavelmente restritivas, mas o frontend delega a autorização de signed URL ao Storage. É obrigatório testar path próprio e cruzado no ambiente real.

### 5.6 propostas locais importadas durante leitura

**Classificação:** **CONFIRMADO NO CÓDIGO; efeito produtivo NÃO REPRODUZIDO.**

É um caminho legado inadequado para produção porque leitura pode produzir escrita. Sem acesso ao banco real e sem inventário do conteúdo local dos browsers reais, removê-lo agora poderia ocultar dados ainda não migrados. Fica marcado para contenção assim que a compatibilidade for comprovada.

## 6. Contenção executada nesta rodada

**Nenhuma alteração de autorização, RLS, RPC, Storage ou fluxo público foi implementada ainda.**

Motivo: o critério do handoff exige correção apenas de P0 **comprovado**, com demonstração de acesso permitido e negado e preservação de convites legítimos. O projeto Supabase correto não está disponível no conector atual, logo qualquer migration de segurança agora seria baseada apenas em hipótese/repo e poderia quebrar produção.

Essa decisão é deliberada: **não confundir prudência com ausência de risco**. Os riscos acima permanecem abertos.

## 7. Próxima sequência segura

Quando o Supabase correto estiver disponível em read-only:

1. reconciliar migrations aplicadas × `supabase/migrations` × `drizzle/migrations`;
2. inspecionar imediatamente `portal_content_blocks`, grants e policies;
3. inspecionar `implementation_projects` e `implementation_property_details` com grants/policies reais;
4. listar functions/RPCs públicas, owners, `SECURITY DEFINER`, `search_path` e EXECUTE grants;
5. inspecionar buckets/policies de Storage;
6. criar identidades de teste/controladas ou usar ambiente seguro para a matriz allow/deny;
7. reproduzir riscos sem registrar PII real;
8. somente então criar migration **nova, incremental e revisável** para cada P0 confirmado;
9. executar typecheck/lint/testes/RLS/RPC/Storage/build/smoke pertinentes;
10. validar sincronização/visual no Lovable somente depois do GitHub.

## 8. Conclusão

**FASE A/P0 NÃO CONCLUÍDA.**

O inventário de código e das superfícies públicas está documentado, mas o critério de conclusão depende do schema real, histórico aplicado, autorização por identidade e Storage do projeto Supabase correto. Até esse acesso existir, nenhum risco dependente do banco será declarado resolvido e nenhuma fase posterior será iniciada automaticamente.
