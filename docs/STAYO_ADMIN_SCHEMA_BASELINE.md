# STAYO ADMIN — SCHEMA BASELINE

> **Fase A / Contenção P0 — inventário e baseline real**  
> Data da auditoria: 23/09/2026  
> Status: **BASELINE PARCIAL — banco produtivo não acessível pelo conector disponível**  
> Este documento é **documentação do estado observado**. Não é DDL, não deve ser executado como migration e não autoriza reaplicação de migrations históricas.

## 1. Escopo e regra de evidência

Este baseline cobre a frente **Implantação + Proprietário + Portal do Proprietário**, com foco nas superfícies que podem conter PII, documentos, dados bancários/Pix, credenciais de Wi-Fi/acesso, notas internas, drafts e snapshots comerciais.

Classificação usada:

- **CONFIRMADO** — observado diretamente no estado atual do GitHub/Lovable ou reproduzido no ambiente correto.
- **INFERIDO DO REPOSITÓRIO** — comportamento definido por código/migration atual, sem prova de que o mesmo DDL esteja aplicado no banco remoto.
- **NÃO VERIFICADO** — exige inspeção/reprodução no banco real ou identidade de teste e não pôde ser comprovado.
- **BLOQUEADO** — a fonte necessária está inacessível ou não corresponde ao ambiente do STAYO ADMIN.

Nenhuma migration histórica foi editada, reaplicada ou executada durante esta auditoria.

## 2. Estado canônico antes de editar

### GitHub

- Repositório: `joaovictorfer/stayo-adm`
- Branch canônica: `main`
- HEAD observado antes da criação deste baseline: `2fdab6fef8d4cde84f9ffb49a834deff9991f4eb`
- Mensagem: `fix(owner-journey): impede convite sem proposta vinculada`
- Branch sem proteção obrigatória observada na API do GitHub.

**Estado:** CONFIRMADO.

### Lovable

- Projeto: `Stayo Adm`
- Project ID: `696b2125-0bf9-4538-8458-05d88fc5e8a2`
- No início da auditoria, o projeto retornou o mesmo `latest_commit_sha` do GitHub (`2fdab6f...`) e estava publicado/ready.
- Lovable foi consultado somente para estado/sincronização; nenhuma edição foi feita nele.

**Estado:** CONFIRMADO no início da auditoria; sincronização deve ser reconferida após os commits de documentação.

### Supabase esperado pelo aplicativo

O código/configuração versionada do STAYO ADMIN aponta para um projeto Supabase cujo ref é `dftzonhzxsqghxrvgkkt`.

O conector Supabase disponível nesta sessão listou outro projeto, ref `jsxwyewasvcxkgbpbdvk`, em estado `INACTIVE`. Como os refs não coincidem, ele **não foi utilizado como substituto** para consultar ou alterar o banco do STAYO ADMIN.

Consequências:

- schema remoto real: **BLOQUEADO**;
- histórico de migrations realmente aplicadas: **BLOQUEADO**;
- grants reais: **BLOQUEADO**;
- RLS/policies reais: **BLOQUEADO**;
- functions/RPCs reais e seus owners/grants: **BLOQUEADO**;
- buckets/Storage policies reais: **BLOQUEADO**;
- testes de autorização por identidade: **BLOQUEADO**.

Nenhum SQL foi executado em qualquer projeto Supabase durante esta fase.

## 3. Linhas de migration encontradas no repositório

### `supabase/migrations`

Inventário observado:

1. `0001_admin_foundation.sql`
2. `0002_owner_records.sql`
3. `0003_commercial_terms.sql`
4. `0004_owner_portal_invitations.sql`
5. `0005_outbound_messages.sql`
6. `0006_initial_charges.sql`
7. `0007_owner_onboarding_submissions.sql`
8. `0008_admin_auth_bootstrap.sql`
9. `0009_implementation_projects.sql`
10. `0010_proposals.sql`
11. `0011_checklist_templates.sql`
12. `0012_owner_notes.sql`
13. `0013_owner_auth.sql`
14. `0014_owner_tasks.sql`
15. `0015_attachments.sql`
16. `0016_owner_journey_proposal.sql`

**Aplicação real:** NÃO VERIFICADA.

### `drizzle/migrations`

Inventário observado:

1. `0000_validate_owner_onboarding_submission.sql`
2. `0001_strengthen_owner_onboarding_draft_validation.sql`
3. `0002_add_onboarding_people_and_smart_payout.sql`
4. `0003_fix_owner_onboarding_state_length.sql`
5. `0004_fix_owner_onboarding_atomic_submission.sql`
6. `0005_restore_complete_owner_onboarding_draft.sql`
7. `0006_repair_owner_onboarding_missing_implementation.sql`
8. `0007_repair_owner_account_linking.sql`
9. `0008_owner_portal_property_journey.sql`
10. `0009_owner_portal_shared_property_access.sql`
11. `0010_owner_onboarding_property_details.sql`
12. `0011_admin_implementation_intake.sql`
13. `0012_implementation_cover_storage_policies.sql`
14. `0013_extend_admin_implementation_intake_owners.sql`
15. `0014_supply_catalog_documents_timeline.sql`
16. `0015_admin_condominiums_master_fields.sql`

**Aplicação real:** NÃO VERIFICADA.

### Decisão de governança para esta execução

- Não tentar “alinhar numeração” aplicando ou renomeando migrations antigas.
- Não assumir que a existência de um arquivo SQL representa o banco remoto.
- Tratar `supabase/migrations` como autoridade **futura**, somente depois da reconciliação formal com o banco real.
- Manter a linha Drizzle como evidência histórica/técnica até que cada objeto seja reconciliado.

## 4. Inventário dos objetos relevantes

A coluna **Estado real** abaixo descreve a possibilidade de confirmar o objeto no banco, não a existência do arquivo no GitHub.

| Objeto | Finalidade / dados relevantes | Origem conhecida no repositório | Segurança declarada no repositório | Estado real | Divergência / risco residual | Decisão Fase A |
|---|---|---|---|---|---|---|
| `admin_profiles` | perfis/roles internos | Supabase `0001` | RLS; próprio perfil + super_admin | NÃO VERIFICADO | grants/policies remotos desconhecidos | somente inventário |
| `audit_logs` | auditoria sanitizada | Supabase `0001` | RLS; insert interno e leitura admin/super_admin | NÃO VERIFICADO | cobertura real dos eventos não comprovada | somente inventário |
| `owner_records` | nome, telefone, e-mail, documento, lifecycle | Supabase `0002` | RLS interna; owner lê próprio registro após `0013` | NÃO VERIFICADO | PII; projeção direta da tabela pelo owner depende de policy real | somente inventário |
| `commercial_term_defaults` | defaults comerciais | Supabase `0003` | staff-only | NÃO VERIFICADO | estado aplicado desconhecido | somente inventário |
| `commercial_terms` | snapshot comercial por implantação | Supabase `0003` | staff-only direto | NÃO VERIFICADO | exposto ao token somente via RPC mais recente se aplicada | somente inventário |
| `owner_portal_invitations` | convite, hash, expiração, uso, revogação, owner/proposal | Supabase `0004`, `0013`, `0016` | tabela staff-only; RPCs públicas resolvem token | NÃO VERIFICADO | schema remoto e compatibilidade de convites legados desconhecidos | não alterar sem prova |
| `owner_onboarding_submissions` | nome, documento, e-mail, telefone, Pix e campos posteriores | Supabase `0007` + Drizzle `0000-0006` | staff-only direto; escrita pública via RPC security-definer | NÃO VERIFICADO | múltiplas evoluções em duas linhas de migration; PII/financeiro | reconciliação obrigatória |
| `implementation_projects` | implantação, owner, endereço, cidade, notas, status etc. | Supabase `0009` + Drizzle `0011/0013` | staff; `0013` adiciona leitura do próprio owner | NÃO VERIFICADO | cliente do Portal faz `select('*')`; possível exposição de colunas internas ao owner | matriz pública + teste real |
| `implementation_owners` | coproprietários/vínculos | Drizzle `0013` e dependências | políticas dependem da linha Drizzle | NÃO VERIFICADO | origem/aplicação remota desconhecida | reconciliação obrigatória |
| `implementation_contract_conditions` | taxa, responsabilidade de limpeza, repasse, limite, exclusividade, prazo | Drizzle `0011` e consumo em Supabase `0016` | RPC pública `0016` projeta condições | NÃO VERIFICADO | origem não está na linha Supabase inicial; `0016` depende do objeto existir | não aplicar `0016` sem reconciliação |
| `implementation_property_details` | endereço, tipologia, acesso, código, Wi-Fi/senha, notas | Drizzle `0008`, `0010`, `0011` | owner autenticado pode ler/escrever por RLS; token pode ler/escrever por RPC | NÃO VERIFICADO | campo oficial recebe dado sensível diretamente do owner/token, sem etapa de revisão | deferir desenho completo; testar antes de conter |
| `implementation_rooms` | ambientes/quartos | linha Drizzle/evoluções de implantação | desconhecida no remoto | NÃO VERIFICADO | schema/policies atuais não confirmados | somente inventário |
| `implementation_items` | checklist/tarefas de implantação | Supabase `0009` e evoluções | owner só deveria ver `owner_visible` nos consumidores/policies | NÃO VERIFICADO | regra real precisa ser confirmada | somente inventário |
| `implementation_supply_items` | enxoval/compras; pode incluir fornecedor, custo, payee/Pix | Drizzle `0014` | staff-only esperado | NÃO VERIFICADO | contém dado financeiro de terceiro | somente inventário |
| `supply_catalog_items` | catálogo/fornecedor | Drizzle `0014` | staff-only | NÃO VERIFICADO | policy real não confirmada | somente inventário |
| `supply_item_documents` | proposta/fatura/NF/contrato de compra | Drizzle `0014` | staff-only | NÃO VERIFICADO | Storage e metadados precisam ser testados juntos | somente inventário |
| `proposals` | proposta versionada/aceite | Supabase `0010`, `0016` | staff direto; owner por RLS; token por RPC | NÃO VERIFICADO | coexistência com import automático de localStorage; versionamento remoto não comprovado | matriz + contenção só após reprodução |
| `proposal_share_links` | compartilhamento legado de proposta | Supabase `0010`; store local ainda existe | tabela/RLS e store local coexistem | NÃO VERIFICADO | fluxo legado de token não é fonte única; risco de compatibilidade | não remover nesta fase |
| `owner_portal_accounts` | auth user ↔ owner | Supabase `0013` | RLS da própria conta; criação por RPC | NÃO VERIFICADO | vínculo depende de convite e policies reais | somente inventário |
| `owner_tasks` | pendências do proprietário | Supabase `0014` | owner lê próprias; staff gerencia | NÃO VERIFICADO | policy real não confirmada | somente inventário |
| `owner_notes` | notas internas | Supabase `0012` | sem policy para owner/anon no SQL versionado | NÃO VERIFICADO | store local ainda é consumidor; banco real não confirmado | manter como interno; migrar depois |
| `initial_charges` | cobrança inicial, itens, valor, referência | Supabase `0006`; owner read em `0013` | finance/admin direto; owner próprio após vínculo | NÃO VERIFICADO | dado financeiro; columns projetadas diretamente dependem da policy real | somente inventário |
| `attachments` | metadados de documentos/anexos | Supabase `0015` | staff + owner próprio SELECT | NÃO VERIFICADO | upload de owner precisa reconciliar policy de metadata vs Storage | testar fluxo completo |
| `implementation_timeline_updates` | timeline; descrição; owner_visible | Drizzle `0008`/`0014` | owner apenas `owner_visible` no SQL versionado | NÃO VERIFICADO | consumers devem filtrar/projetar explicitamente | somente inventário |
| `implementation_inspections` | vistoria, public_notes/internal_notes | Drizzle `0008` | owner policy exige `owner_visible`; consumer seleciona `public_notes` | NÃO VERIFICADO | garantir que `internal_notes` não saiam em projeções públicas | somente inventário |
| `portal_content_blocks` | conteúdo draft + publicado do Portal | conhecido pela Fonte Mestra; migration de origem não localizada nas duas linhas auditadas | Fonte Mestra registra SELECT público amplo no snapshot anterior | NÃO VERIFICADO | **alto risco histórico:** draft pode estar acessível a anon; objeto real não consultável hoje | prioridade máxima ao restabelecer DB |

## 5. Functions/RPCs relevantes encontradas no repositório

| Function/RPC | Modelo | Identidades declaradas | Validações observadas em código SQL versionado | Estado real | Observação |
|---|---|---|---|---|---|
| `current_admin_role()` | SECURITY DEFINER | uso interno | `auth.uid()`, perfil ativo | NÃO VERIFICADO | helper de autorização |
| `has_admin_role(...)` | SECURITY DEFINER | uso interno | compara role atual | NÃO VERIFICADO | base de diversas policies |
| `owner_onboarding_resolve_token(text)` | SECURITY DEFINER | `anon`, `authenticated` | hash SHA-256; retorna metadados do convite | NÃO VERIFICADO | resolver original não filtra sozinho expiração/revogação; UI/submit tratam status |
| `owner_onboarding_submit(...)` | SECURITY DEFINER | `anon`, `authenticated` | token existente, não revogado, não usado, não expirado; lock; marca `used_at` | NÃO VERIFICADO | grava PII/Pix; evoluído depois por migrations Drizzle |
| `owner_account_link(text)` | SECURITY DEFINER | `authenticated` | exige sessão, token, não revogado/não expirado, owner vinculado | NÃO VERIFICADO | não usa `used_at` como bloqueio; compatibilidade pode ser intencional |
| `owner_can_access_implementation(uuid)` | SECURITY DEFINER | `authenticated` | owner_id direto ou coproprietário | NÃO VERIFICADO | origem Drizzle `0008` |
| `owner_property_details_resolve_by_token(text)` | SECURITY DEFINER | `anon`, `authenticated` | comprimento, hash, não revogado, não expirado | NÃO VERIFICADO | retorna endereço, código, rede e senha Wi-Fi |
| `owner_property_details_save_by_token(text,jsonb)` | SECURITY DEFINER | `anon`, `authenticated` | token válido e tipos básicos | NÃO VERIFICADO | escreve direto na tabela oficial |
| `admin_create_implementation(jsonb)` | SECURITY INVOKER | `authenticated` | checa admin role | NÃO VERIFICADO | escreve projeto/contrato/property details |
| `owner_journey_resolve_proposal(text)` | SECURITY DEFINER | `anon`, `authenticated` | token/hash, não revogado, não expirado, proposal vinculada | NÃO VERIFICADO | criada em Supabase `0016`, não comprovada no remoto |
| `owner_journey_accept_proposal(text,text)` | SECURITY DEFINER | `anon`, `authenticated` | token/hash, revogação/expiração, aceite/auditoria/cobrança idempotente | NÃO VERIFICADO | criada em Supabase `0016`, não comprovada no remoto |

**Revisão obrigatória quando o DB correto estiver disponível:** owner/definition, `prosecdef`, `proconfig/search_path`, `EXECUTE` por role, PUBLIC grants implícitos, corpo real, dependências, retorno de PII e comportamento em replay.

## 6. Storage observado no repositório

### `owner-attachments`

- Migration Supabase `0015` declara bucket privado.
- Convenção de path: `<owner_id>/<uuid>-<filename>`.
- SQL versionado declara staff com acesso e owner com SELECT/INSERT somente na própria pasta.
- Frontend gera signed URL temporária (default 300 s) via `createSignedUrl(storagePath)`.
- Metadados vivem em `attachments`.

**Estado real do bucket/policies:** NÃO VERIFICADO.

### `implementation-covers`

- Policies na linha Drizzle `0012` restringem leitura/escrita a roles internas.
- Criação/configuração real do bucket não foi comprovada nesta auditoria.

**Estado real:** NÃO VERIFICADO.

### `supply-documents`

- Policies na linha Drizzle `0014` são staff-only.
- Bucket e policies reais não puderam ser consultados.

**Estado real:** NÃO VERIFICADO.

## 7. Divergências relevantes entre código e migrations

### 7.1 Duas linhas de migration

Há evolução de schema em `supabase/migrations` e em `drizzle/migrations`. Vários objetos usados pelo código atual — especialmente detalhes do imóvel, coproprietários, condições contratuais e policies de Storage — têm evolução apenas ou principalmente na linha Drizzle, enquanto a migration Supabase `0016` já depende de parte dessa estrutura.

**Risco:** aplicar `0016` isoladamente em um banco que não possua a evolução Drizzle correspondente pode falhar ou criar contrato parcial.

### 7.2 `portal_content_blocks`

A Fonte Mestra registra que o objeto possui draft e published na mesma tabela e que, no snapshot anterior, havia policy pública ampla. Nesta auditoria, nenhuma migration que cria/corrige esse objeto foi localizada nas duas linhas versionadas inspecionadas.

**Risco:** origem e segurança atuais podem estar fora do histórico versionado disponível. Este é um motivo adicional para não escrever uma migration corretiva “no escuro”.

### 7.3 Portal lê linhas completas

`src/lib/api/owner-portal-data.ts` usa `select('*')` em `implementation_projects` e `implementation_property_details`. Se RLS permitir a linha ao owner, todas as colunas concedidas pela tabela podem ficar disponíveis ao cliente, inclusive campos que não foram desenhados como projeção pública.

**Risco:** autorização de linha não substitui minimização de colunas.

### 7.4 Escrita oficial pelo proprietário/token

A linha Drizzle permite owner autenticado fazer INSERT/UPDATE em `implementation_property_details`; outra RPC por token também grava os mesmos campos oficiais. Isso inclui endereço, código de acesso e Wi-Fi/senha.

**Risco arquitetural:** dado enviado pelo proprietário pode se tornar dado oficial sem a etapa `submitted/reviewed`, contrariando a direção futura do produto. A correção completa depende da fase de submissão/revisão; não será improvisada nesta contenção.

## 8. O que ainda precisa ser extraído do banco real

Assim que o acesso ao projeto Supabase correto for restabelecido, coletar em **somente leitura**:

1. `supabase_migrations.schema_migrations` / histórico equivalente;
2. tabelas/views/materialized views dos schemas relevantes;
3. colunas, tipos, defaults, nullability;
4. PK/FK/unique/check constraints;
5. índices;
6. triggers e funções chamadas;
7. functions/RPCs, owner, language, `SECURITY DEFINER/INVOKER`, `search_path`;
8. grants de schema/table/sequence/function;
9. `pg_policies` e estado `relrowsecurity/relforcerowsecurity`;
10. buckets `storage.buckets`;
11. policies de `storage.objects`;
12. objetos `portal_content_blocks` e eventual view/RPC pública;
13. contagem/metadata sanitizada suficiente para confirmar objetos sem expor PII;
14. testes por identidade/token descritos na matriz pública.

## 9. Decisão desta execução até este ponto

- **Nenhuma contenção de banco criada ou aplicada**, porque o banco real não pôde ser comparado ao histórico versionado.
- **Nenhuma migration histórica alterada.**
- **Nenhum P0 de produção declarado resolvido sem reprodução.**
- Os riscos de `portal_content_blocks`, projeções completas do Portal, escrita de `implementation_property_details` e Storage permanecem abertos até prova no ambiente correto.

## 10. Critério de conclusão

**FASE A/P0 NÃO CONCLUÍDA.**

Bloqueio objetivo: o conector Supabase disponível não corresponde ao projeto configurado no STAYO ADMIN, impedindo concluir o baseline real, o histórico aplicado e as provas de autorização permitida/negada. A próxima ação segura é restabelecer acesso **read-only** ao Supabase correto e continuar a partir deste inventário, sem reaplicar migrations históricas.
