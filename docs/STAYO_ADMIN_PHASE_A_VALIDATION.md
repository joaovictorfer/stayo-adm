# STAYO ADMIN — FASE A / VALIDAÇÃO REAL E CONTENÇÃO P0

> Data: 23/09/2026  
> Escopo: Implantação + Proprietário + Portal do Proprietário  
> Fonte de banco validada: Lovable Cloud do projeto `Stayo Adm` (`696b2125-0bf9-4538-8458-05d88fc5e8a2`)  
> Modo da auditoria no banco: **somente leitura**  
> Status geral: **AUDITORIA REAL CONCLUÍDA / CONTENÇÃO P0 VERSIONADA NO GITHUB / NÃO APLICADA NO BANCO**

Este relatório **substitui o status de “banco bloqueado”** registrado no início de `STAYO_ADMIN_SCHEMA_BASELINE.md` e `STAYO_ADMIN_PUBLIC_SURFACE_MATRIX.md`. Aqueles documentos permanecem como inventário inicial; as conclusões abaixo refletem a validação posterior contra o PostgreSQL/Supabase real do Lovable Cloud.

## 1. Fontes verificadas

### GitHub

- Repositório: `joaovictorfer/stayo-adm`
- Branch: `main`
- O fluxo de edição permaneceu exclusivamente no GitHub.
- Nenhuma migration foi executada por Lovable durante esta auditoria.

### Lovable Cloud / Supabase

- Database habilitado: **sim**
- Stack reportado pelo projeto: **Supabase**
- Schemas relevantes encontrados: `auth`, `drizzle`, `public`, `storage`.
- Controle de migrations do Cloud: `drizzle.__drizzle_migrations`.
- Quantidade observada durante a auditoria: **28 registros**.
- A linha ativa versionada no repositório é `drizzle/migrations` e termina, antes da contenção desta fase, em `0015_admin_condominiums_master_fields.sql`.

A pasta `supabase/migrations` existe no repositório, mas não deve ser tratada como prova de aplicação no Lovable Cloud. Em especial, `supabase/migrations/0016_owner_journey_proposal.sql` está versionada no GitHub, porém suas RPCs/colunas não estavam presentes no banco real durante esta auditoria.

## 2. Estado real dos dados auditados

Contagens observadas no banco real:

| Objeto | Registros |
|---|---:|
| `implementation_projects` | 4 |
| `implementation_property_details` | 2 |
| `owner_records` | 7 |
| `owner_portal_accounts` | 2 |
| `owner_portal_invitations` | 11 |
| `attachments` | 0 |
| `proposals` | 0 |
| `proposal_share_links` | 0 |
| `portal_content_blocks` | 0 |
| `storage.objects` | 0 |

Convites de proprietário observados:

- total: 11;
- válidos no momento da consulta: 5;
- revogados: 6;
- expirados: 0;
- usados: 1.

Os snapshots de convites válidos possuem, entre outras, chaves de contato (`ownerEmail`, `ownerPhone`), status, proposta e identificação do imóvel. Os valores não foram expostos neste relatório.

## 3. Provas negativas de autorização

### 3.1 Identidade `anon`

Executado com role de banco `anon`. Resultado: **zero linhas visíveis** em:

- `implementation_projects`;
- `implementation_property_details`;
- `owner_records`;
- `owner_portal_accounts`;
- `owner_portal_invitations`;
- `owner_notes`;
- `owner_tasks`;
- `initial_charges`.

**Conclusão:** não foi reproduzida leitura anônima de dados de proprietário/implantação nessas tabelas.

### 3.2 Usuário autenticado sem vínculo

Foi simulada uma sessão `authenticated` com UUID sem perfil administrativo e sem vínculo de owner. Resultado: zero linhas visíveis nas mesmas superfícies críticas.

**Conclusão:** não foi reproduzido acesso por usuário autenticado sem vínculo.

### 3.3 Owner-only real

Foi usada uma conta existente que possui vínculo em `owner_portal_accounts`, não possui `admin_profile` e não possui implantação vinculada. Resultado:

- `owner_records`: 1 linha — o próprio registro;
- `owner_portal_accounts`: 1 linha — a própria conta;
- implantações, detalhes de imóvel, convites, notas internas, tarefas, cobranças e propostas: 0 linhas.

**Conclusão:** o isolamento disponível para esta identidade se comportou corretamente.

A outra conta de owner existente também é `super_admin`; portanto ela não foi usada como prova de isolamento de proprietário, pois suas permissões internas ampliam legitimamente a leitura.

## 4. Tokens e RPCs públicas

Foram inspecionadas as funções públicas críticas e seus corpos reais.

### Com proteção de token adequada observada

As funções abaixo utilizam hash SHA-256 do token e validam expiração/revogação no caminho crítico:

- `owner_account_link`;
- `owner_onboarding_draft_resolve_v2` (delegando ao fluxo base e revalidando convite);
- `owner_onboarding_draft_save_v2`;
- `owner_property_details_resolve_by_token`;
- `owner_property_details_save_by_token`;
- `owner_portal_resolve`;
- `owner_portal_accept_proposal`.

`owner_account_link` também exige sessão autenticada, cadastro finalizado, mesmo e-mail informado no onboarding e impede vincular uma conta já associada a outro proprietário.

### Teste com token inexistente

Como `anon`, um token inexistente não resolveu:

- convite;
- draft de onboarding;
- detalhes do imóvel;
- proposta legada;
- portal por token.

Resultado: 0 linhas ou `NULL`, conforme o contrato da função.

### Legado de proposta

`proposal_resolve_by_token` e `proposal_accept_by_token` validam o hash do token, mas **não possuem checagem de expiração/revogação no corpo atual**.

No banco real, `proposal_share_links` e `proposals` estão vazias. Logo:

- risco estrutural: **CONFIRMADO**;
- exposição/aceite indevido atual: **NÃO REPRODUZIDO por ausência de dados**;
- decisão da Fase A: **não alterar o legado às cegas**, pois a jornada atual está em transição e a migration nova ainda não foi reconciliada com o Cloud.

## 5. Storage

Buckets observados:

- `implementation-covers` — privado;
- `owner-attachments` — privado;
- `supply-documents` — privado.

`owner-attachments` restringe owner a caminhos cujo primeiro segmento corresponde ao `owner_id` vinculado à sessão. Capas e documentos de compras possuem policies internas por role.

`storage.objects` estava vazio durante a auditoria. Assim:

- configuração estrutural privada: **CONFIRMADA**;
- teste real de download cruzado entre dois owners: **NÃO REPRODUZÍVEL por ausência de objetos**.

## 6. P0 confirmado — `portal_content_blocks`

### Estado real

A tabela possui na mesma linha:

- `draft_title`;
- `draft_body`;
- `published_title`;
- `published_body`;
- `published_at`.

A policy real observada era:

- nome: `qualquer visitante lê blocos do portal`;
- comando: `SELECT`;
- condição: `USING (true)`.

O papel `anon` também possui `SELECT` direto na tabela.

### Classificação correta

A tabela estava vazia, portanto **não foi reproduzido vazamento atual de conteúdo**.

Entretanto, a autorização é estruturalmente insegura: assim que uma linha existir, um visitante anônimo poderá selecionar a linha inteira. Filtrar apenas `published_at IS NOT NULL` não resolve, pois as colunas `draft_*` permanecem no mesmo registro publicado.

Classificação: **P0 ESTRUTURAL CONFIRMADO / EXPOSIÇÃO ATUAL NÃO REPRODUZIDA POR AUSÊNCIA DE DADOS**.

### Contenção preparada

Foi criada no GitHub a migration Drizzle:

`drizzle/migrations/0016_lock_down_portal_content_blocks.sql`

A migration:

1. remove a policy `qualquer visitante lê blocos do portal`;
2. revoga privilégios da role `anon` sobre a tabela base;
3. não altera acesso de staff autenticado nem `service_role`;
4. não cria ainda uma projeção pública nova.

Uma futura integração com o Guia deverá expor somente uma view/RPC explícita com campos `published_*`, jamais `SELECT *` da tabela base.

**Estado:** versionada no GitHub; **não aplicada no Lovable Cloud**.

Após o commit, o Lovable sincronizou o novo HEAD, porém o banco permaneceu com 28 migrations e a policy pública continuou presente. Isso confirma que o fluxo GitHub → preview não aplicou automaticamente o DDL.

## 7. Divergência funcional confirmada — Owner Journey

O código atual da jornada chama:

- `owner_journey_resolve_proposal`;
- `owner_journey_accept_proposal`.

Essas funções **não existem no Lovable Cloud** durante esta auditoria. `owner_portal_invitations` também não possui a coluna `proposal_id` prevista pela migration `supabase/migrations/0016_owner_journey_proposal.sql`.

Portanto:

- GitHub contém uma migration de jornada na linha `supabase/migrations`;
- Lovable Cloud usa a linha Drizzle como histórico aplicado;
- a nova jornada de proposta não está completamente materializada no banco real.

Classificação: **DIVERGÊNCIA CONFIRMADA / BLOQUEIO FUNCIONAL**, não P0 de segurança.

Decisão: não aplicar nem converter essa migration dentro da contenção P0. Ela deve entrar em uma etapa própria de reconciliação de migrations/Owner Journey após encerramento formal da Fase A.

## 8. localStorage / persistência residual

Permanece confirmado no código:

- fallback do `AdminApiClient` para adapter local quando Supabase não está configurado;
- quick intake draft em `localStorage`;
- stores legados;
- caminho de compatibilidade de proposals que pode importar dados locais para Supabase durante leitura.

Esses pontos são riscos de integridade/persistência e devem ser tratados na fase de persistência real. Não houve evidência suficiente para classificá-los como P0 de exposição de dados nesta auditoria.

## 9. Resultado da Fase A

### Confirmado seguro nos testes executáveis

- anon não lê PII/implantação nas tabelas críticas auditadas;
- usuário autenticado sem vínculo não lê dados de owner;
- owner-only de controle vê apenas o próprio registro/conta;
- buckets relevantes são privados;
- token inexistente não resolve as RPCs públicas testadas;
- notas internas não foram expostas ao owner de controle.

### P0 estrutural confirmado

- leitura pública irrestrita da tabela base `portal_content_blocks`.
- contenção versionada em `drizzle/migrations/0016_lock_down_portal_content_blocks.sql`.
- **ainda pendente de aplicação controlada no banco**.

### Não reproduzível / não verificável com os dados atuais

- acesso cruzado a arquivo de outro owner: Storage vazio;
- acesso cruzado owner A → imóvel de owner B: a única conta owner-only disponível não possui implantação e a conta com implantação também é super_admin;
- vazamento real de `portal_content_blocks`: tabela vazia;
- replay de share link de proposta legado: tabelas legadas vazias;
- token expirado: não havia convite expirado no conjunto observado.

## 10. Commits da contenção

- `252ce3e2e1824856e327fd08e117afac86afdc81` — `fix(security): bloqueia leitura anon de blocos do portal`
- `8a7a56d732bc07efc9ed8a1167ade3c8009a6bbb` — `chore(drizzle): registra snapshot da migration 0016`
- `a763f54dd4644759ce74e6f4da11f3b19e1a3ca5` — `chore(drizzle): registra migration 0016 no journal`

## 11. Próximo gate

A Fase A só pode ser declarada **corrigida em produção** após aplicação controlada da migration Drizzle 0016 e repetição dos testes:

1. `anon` sem `SELECT` na tabela base;
2. policy pública `USING (true)` ausente;
3. staff autorizado continua lendo/gerenciando os blocos;
4. eventual consumidor público usa somente uma projeção published-only, se/quanto ela for necessária;
5. CI e regressão funcional sem quebra.

Até lá, a classificação correta é:

**FASE A AUDITADA E CONTENÇÃO PREPARADA — P0 AINDA NÃO APLICADO NO BANCO.**
