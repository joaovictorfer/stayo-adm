# STAYO ADMIN — FASE 2 / PRONTIDÃO DA JORNADA COMERCIAL

> Data da auditoria: 24/09/2026  
> Escopo: oportunidade leve → proposta → reunião → convite individual  
> Status: **FASE 2 BLOQUEADA PARA PUBLICAÇÃO / FUNDAÇÃO ISOLADA PREPARADA NO GITHUB**

Este documento registra somente fatos confirmados contra a `main`, o projeto Lovable `Stayo Adm` e o PostgreSQL/Supabase do Lovable Cloud. A existência de SQL versionado não é tratada como prova de aplicação.

## 1. Estado canônico confirmado antes da execução

- Repositório: `joaovictorfer/stayo-adm`.
- Branch: `main`.
- HEAD inicial desta execução: `795c045ae794998e4360a5dfaf58ada4415b74e4`.
- Lovable: `Stayo Adm`, Project ID `696b2125-0bf9-4538-8458-05d88fc5e8a2`.
- Lovable estava `ready` e sincronizado com o mesmo HEAD.
- Banco do projeto: habilitado no Lovable Cloud, stack `supabase`.
- Ref configurado pelo STAYO ADMIN: `dftzonhzxsqghxrvgkkt`.
- O conector Supabase disponível nesta sessão não possui permissão sobre esse ref; portanto ele não foi usado para DDL.

Lovable foi utilizado somente para consultas read-only do banco e estado do projeto. Nenhum DDL, DML ou prompt de implementação foi enviado ao Lovable.

## 2. Resultado dos gates obrigatórios

| Gate | Evidência atual | Resultado |
|---|---|---|
| P0 `portal_content_blocks` fechado | A policy `qualquer visitante lê blocos do portal` continua `SELECT USING (true)` e `anon` continua com `SELECT` na tabela base | **BLOQUEADO** |
| Fase 1 oportunidade leve real | `Nova implantação` ainda coleta dados amplos, persiste rascunho em `localStorage`, pode criar condomínio a partir de texto e cria implantação com campos de imóvel | **BLOQUEADO** |
| Histórico de migrations reconciliado | Lovable Cloud registra `drizzle.__drizzle_migrations` até a migration equivalente à Drizzle `0015`; Drizzle `0016` P0 está no GitHub e não no banco; `supabase_migrations.schema_migrations` não existe | **BLOQUEADO PARA TRANSIÇÃO DE AUTORIDADE** |
| Jornada convite/proposta aplicada | `owner_portal_invitations` não possui `proposal_id`; `owner_journey_resolve_proposal` e `owner_journey_accept_proposal` não existem no banco | **BLOQUEADO** |
| Persistência de reunião | Não existe tabela de oportunidade/reunião comercial no schema público auditado | **NÃO IMPLEMENTADA** |

Consequência: **nenhum novo link produtivo da Fase 2 deve ser disponibilizado**. A rota pública existente não será ampliada até que os gates acima sejam fechados e validados no banco correto.

## 3. Fase 1 — divergência confirmada

O fluxo atual de `src/routes/implantacao.index.tsx` não corresponde ao contrato da oportunidade leve:

- exige/aceita cedo demais e-mail, documento, endereço, Pix/banco, condomínio, torre, unidade, cidade, acesso, Wi-Fi e outras informações;
- utiliza `implementation-intake-draft` em `localStorage` como rascunho;
- se houver nome de condomínio sem `condominium_id`, pode criar `admin_condominiums` automaticamente;
- cria `implementation_projects` já preenchendo campos de pré-imóvel;
- não possui um campo explícito de título provisório da oportunidade como primeiro contrato comercial.

Antes da publicação da Fase 2, a Fase 1 precisa ser entregue com persistência real compartilhada entre navegadores, sem criar condomínio ou Property operacional fictícios.

## 4. Proposta atual — auditoria do contrato

### Tabelas reais

Foram confirmadas no banco:

- `proposals`;
- `proposal_share_links`;
- `proposal_content_blocks`;
- `implementation_proposal_settings`.

`proposals` hoje guarda a versão, `items`, `total` e aceite. Ela ainda não possui estado explícito de publicação/apresentação, flag de aceite habilitado, snapshot completo publicado ou signatários comerciais.

`proposal_content_blocks` é staff-only por RLS e possui visibilidade `interno`, `proposta` ou `portal`; seus blocos não estão congelados dentro de uma versão de `proposals`.

### `ProposalTab`

O componente atual:

- salva nova versão de `proposals` com os itens;
- consulta condições comerciais vivas da implantação;
- gera PDF com a proposta + condições vivas;
- ainda pode criar link legado por `proposalShareStore`;
- possui ação de preparação de WhatsApp/outbox;
- não distingue `draft`, `published`, `acceptance_ready`, `accepted` e `superseded`.

### PDF

`src/lib/pdf/proposal-pdf.ts` recebe uma versão de `Proposal`, mas também recebe `ImplementationProject` e `CommercialTerm[]` atuais. Portanto o PDF ainda **não é prova fiel de um snapshot publicado completo**: condições alteradas depois podem mudar o documento gerado para uma versão antiga.

### Store/adapters

`proposalsStore` usa Supabase quando configurado, porém executa `ensureLocalProposalsMigrated()` no caminho normal de leitura/criação. Isso pode promover dados legados de `localStorage` para o banco durante uma leitura.

`proposalShareStore` continua em `localStorage`, com token no navegador. Ele é legado e não serve como mecanismo oficial da nova jornada multi-dispositivo.

## 5. Convite oficial e rota pública

A rota oficial permanece:

`/portal/implantacao/$token`

Ela já trata loading, erro, token inexistente, expirado e revogado antes de montar `OwnerJourney`.

O `OwnerJourney` atual usa a sequência:

`Proposta → Seus dados → Seu imóvel → Seu acesso`

Mas a primeira etapa depende das RPCs `owner_journey_resolve_proposal` e `owner_journey_accept_proposal`, que **não estão materializadas no banco atual**.

A migration `supabase/migrations/0016_owner_journey_proposal.sql` está versionada e descreve o vínculo convite → versão exata, além de aceite transacional/idempotente, mas não foi aplicada. Ela não deve ser reaplicada ou convertida às cegas enquanto o histórico Drizzle/Supabase não for formalmente reconciliado.

## 6. Rota legada `/portal/proposta/$token`

A rota legada deve permanecer apenas para compatibilidade de links antigos.

Problemas atuais que impedem adotá-la como caminho oficial:

- o store de share link do frontend é local ao navegador;
- a tela consulta condições comerciais vivas;
- o aceite é orquestrado no cliente e depois cria auditoria/cobrança em chamadas separadas;
- as RPCs legadas `proposal_resolve_by_token` / `proposal_accept_by_token` não possuem expiração/revogação no contrato atual.

Decisão da Fase 2: **não gerar novos convites por essa rota** e não remover links existentes antes de uma migração de compatibilidade comprovada.

## 7. Fundação isolada adicionada nesta execução

Foram adicionados, sem wiring de UI ou banco:

- `src/types/commercial-journey.ts`;
- `src/lib/commercial-journey-state.ts`;
- `src/lib/commercial-journey-state.test.ts`.

Esses arquivos definem somente o contrato de estado necessário para a futura implementação:

- status de reunião: `scheduled`, `confirmed`, `rescheduled`, `cancelled`, `completed`;
- modalidades: vídeo, telefone e presencial;
- projeção pública mínima da reunião, sem nota interna, autoria ou responsável;
- link de participação somente para reunião `confirmed`, modalidade `video` e URL HTTPS válida;
- estados de apresentação da proposta: `draft`, `published`, `acceptance_ready`, `accepted`, `superseded`;
- próxima ação derivada do estado real: aguardar publicação, aguardar reunião, entrar na reunião, analisar, aceitar ou continuar.

Nenhum desses arquivos é importado pelas rotas atuais. Logo, esta fundação não ativa recurso em produção.

## 8. Contrato de schema proposto — NÃO É MIGRATION

A estrutura abaixo é desenho para a migration futura, depois dos gates. Não foi aplicada nem criada como SQL nesta execução.

### Reunião

Uma entidade do Admin, vinculada à implantação/oportunidade, deverá guardar no mínimo:

- `id`;
- `implementation_id`;
- `starts_at` e `ends_at`;
- `time_zone`;
- `modality`;
- `join_url` opcional;
- `responsible_user_id`;
- `status`;
- `internal_note`;
- `created_by`, `created_at`, `updated_at`.

O histórico de mudanças deverá ser append-only, por exemplo em `implementation_meeting_events`, registrando agendamento, confirmação, reagendamento e cancelamento, com autor e estado anterior/novo. Reagendar não apaga a ocorrência anterior.

A reunião é estado comercial da oportunidade e **não deve fazer parte do snapshot imutável da proposta**. Assim, reagendar atualiza a reunião vigente e seu histórico sem alterar a versão comercial apresentada.

### Snapshot de proposta

A versão publicada precisa congelar em um único snapshot os dados efetivamente apresentados:

- itens e valores;
- condições comerciais;
- condições contratuais/comerciais exibidas;
- responsabilidades;
- blocos de conteúdo públicos daquela versão;
- validade e observações publicáveis;
- regra de aceite e signatários configurados.

A partir de `published`, edição das condições deve gerar nova versão; o snapshot antigo não sofre `UPDATE` de conteúdo.

O PDF deve ser gerado do **mesmo snapshot publicado** consumido pela tela pública.

### Signatários

Coproprietário e representante não viram signatários automaticamente. A futura persistência deve registrar explicitamente quem precisa aceitar e os aceites por pessoa/configuração comercial, sem inferência por papel cadastral.

### Convite

Cada convite novo precisa estar ligado à versão exata de proposta que apresenta. A RPC pública deve retornar apenas a projeção mínima:

- título provisório/contexto comercial publicável;
- snapshot da proposta vinculada;
- estado da proposta e se aceite está habilitado;
- reunião atual publicável;
- próximo passo.

Nunca deve retornar CPF, Pix, banco, documento, Wi-Fi, código de acesso, notas internas, drafts ou dados de outra implantação.

## 9. Estado público desejado

A leitura mobile-first futura seguirá:

1. boas-vindas + título provisório;
2. apresentação curta da STAYO;
3. proposta publicada da versão vinculada;
4. reunião, se houver;
5. resumo de como funciona a implantação;
6. uma ação principal derivada do estado real.

Estados obrigatórios:

- proposta não publicada;
- sem reunião;
- reunião agendada, ainda não confirmada;
- reunião confirmada com/sem link válido;
- reagendada;
- cancelada;
- convite expirado/revogado/inválido;
- loading;
- erro com retry;
- proposta para leitura, sem aceite;
- proposta apta a aceite;
- aceite concluído.

Uma reunião apenas `scheduled` nunca exibe “Entrar na videochamada”. Uma reunião `cancelled`/`rescheduled` nunca conserva link público de participação.

## 10. Cobrança

Aceite comercial e emissão de cobrança são eventos distintos. A UI pública só poderá chamar uma cobrança de real/emitida quando existir registro persistido em estado que represente emissão efetiva. Um registro `draft` ou uma tentativa de integração não pode aparecer como cobrança confirmada.

A migration futura da jornada deve manter aceite atômico/idempotente e impedir duplicação por clique concorrente. A emissão financeira não deve ser simulada apenas por causa do aceite.

## 11. Ordem segura para retomar

1. Aplicar no Supabase correto a contenção P0 já versionada e repetir os testes anon/auth sem vínculo/admin.
2. Entregar e comprovar a Fase 1 leve, com persistência real entre navegadores e sem criação automática de condomínio/Property.
3. Reconciliar formalmente `drizzle/migrations` e `supabase/migrations`; definir a autoridade futura sem alterar histórico aplicado.
4. Materializar de forma incremental o vínculo convite → proposal/version e as RPCs da jornada, após comparar o SQL versionado com o banco.
5. Criar a persistência de reunião + histórico e o snapshot publicado da proposta em migration nova da autoridade definida.
6. Implementar adapters/admin, depois a projeção pública server-side.
7. Alterar `ProposalTab`, PDF e `/portal/implantacao/$token` para consumir o snapshot oficial.
8. Validar RLS, tokens, idempotência, browser independente e 375/390/430 px antes de liberar convites.

## 12. Gate de qualidade desta preparação

Esta execução não deve ser considerada Fase 2 funcional porque não há wiring de UI/banco. Os testes unitários adicionados servem somente para o contrato de estado puro.

A publicação permanece bloqueada enquanto qualquer uma destas condições existir:

- P0 da tabela interna ainda aberto;
- Fase 1 sem persistência leve comprovada;
- convite sem vínculo server-side à versão exata;
- RPCs oficiais ausentes;
- autoridade de migrations não reconciliada;
- schema de reunião/snapshot não aplicado e testado.

**Veredito deste documento: FASE 2 BLOQUEADA PARA PUBLICAÇÃO; PREPARAÇÃO ISOLADA REVISÁVEL NO GITHUB.**
