# STAYO ADMIN — FASE 2 / PRONTIDÃO DA JORNADA COMERCIAL

> Atualizado em: 24/09/2026  
> Escopo: oportunidade leve → proposta → reunião → convite individual  
> Status: **FASE 2 AINDA NÃO LIBERADA PARA PUBLICAÇÃO / P0 DE CONTEÚDO ENCERRADO**

Este documento registra somente fatos confirmados contra o estado atual do GitHub e do Lovable Cloud do projeto `Stayo Adm`.

## 1. Gates já fechados

### Fase 1 — oportunidade comercial leve

**CONCLUÍDA.** A PR #29 foi mergeada. A equipe consegue criar uma oportunidade com nome, telefone e título provisório, persistida em `implementation_projects`, sem criar condomínio ou Property operacional fictícios. As RPCs da Fase 1 foram protegidas por migrations 0017, 0018 e 0019 e a persistência/idempotência foram comprovadas no Lovable Cloud.

### Fase 2A — P0 `portal_content_blocks`

**CONCLUÍDA.** A migration canônica `supabase/migrations/0020_lock_down_portal_content_blocks.sql` foi materializada no Lovable Cloud correto após preflight.

Estado comprovado:

- policy `SELECT USING (true)` removida;
- `anon` sem grants na tabela base;
- `authenticated` comum sem acesso aos registros pela RLS;
- policy administrativa restrita a `authenticated` com `has_admin_role(...) IS TRUE`;
- operador `super_admin` mantém CRUD legítimo;
- nenhuma view/RPC pública criada;
- fixture sintética removida, tabela novamente com 0 registros.

## 2. Gates que permanecem abertos para a Fase 2 pública

| Gate | Estado |
|---|---|
| Oportunidade leve real | **FECHADO — Fase 1 concluída** |
| P0 `portal_content_blocks` | **FECHADO — 0020 aplicada e validada** |
| Convite ligado server-side à versão exata da proposta | **ABERTO** |
| RPCs oficiais da Owner Journey materializadas | **ABERTO** |
| Snapshot publicado e imutável da proposta/PDF | **ABERTO** |
| Persistência estruturada de reunião + histórico | **ABERTO** |
| Autoridade/reconciliação das migrations para a jornada restante | **ABERTO para a migration específica da jornada** |
| RLS/tokens/idempotência do novo convite público | **ABERTO** |

Consequência: encerrar a Fase 2A **não libera automaticamente novos links públicos da Fase 2**.

## 3. Proposta atual — pontos ainda pendentes

As tabelas `proposals`, `proposal_share_links`, `proposal_content_blocks` e `implementation_proposal_settings` existem, mas a versão de `proposals` ainda não representa um snapshot completo publicado de todos os dados apresentados.

O `ProposalTab` ainda trabalha com condições comerciais vivas da implantação e o PDF recebe `Proposal` + `ImplementationProject` + termos atuais. Portanto a futura Fase 2 precisa garantir que tela pública e PDF consumam o mesmo snapshot imutável da versão publicada.

O `proposalShareStore` legado continua inadequado como mecanismo oficial multi-dispositivo. A rota `/portal/proposta/$token` deve permanecer somente como compatibilidade até que exista migração segura.

## 4. Convite oficial e Owner Journey

A rota oficial planejada continua:

`/portal/implantacao/$token`

O código possui uma jornada de proprietário, porém o vínculo convite → proposal/version e as RPCs oficiais devem ser comparados novamente com o banco e materializados de forma incremental antes de novos convites produtivos.

A existência de `supabase/migrations/0016_owner_journey_proposal.sql` no GitHub não deve ser tratada como prova de aplicação nem executada historicamente às cegas.

## 5. Reunião comercial

A Fase 1 não simulou reunião em `notes` ou localStorage. O schema estruturado de reunião + histórico permanece pendente para a próxima etapa autorizada.

As regras puras já existentes em `commercial-journey-state` continuam válidas como preparação isolada: link de videochamada somente para reunião confirmada com URL HTTPS, sem expor notas internas ou autoria.

## 6. Governança de migrations

A antiga contenção Drizzle 0016 não foi reaplicada. A correção P0 foi reconciliada como nova migration Supabase 0020.

Para as próximas mudanças, é obrigatório continuar:

1. auditar o schema real;
2. criar migration nova e incremental no GitHub;
3. materializar o arquivo exato no Lovable Cloud somente quando autorizado;
4. validar RLS/grants/functions e efeitos colaterais;
5. nunca fabricar histórico de migration que o ambiente não mantém automaticamente.

## 7. Segurança pública após Fase 2A

O fechamento de `portal_content_blocks` removeu um bloqueador, mas a jornada comercial pública ainda precisa comprovar separadamente:

- token opaco/hash/expiração/revogação;
- vínculo exato ao convite e versão;
- projeção mínima sem PII/drafts/notas;
- aceite transacional e idempotente quando aplicável;
- isolamento entre proprietários/oportunidades;
- compatibilidade segura da rota legada.

## 8. Próxima retomada

A próxima fase, quando autorizada, deve começar por uma auditoria atual das propostas/convites/RPCs e não por pressupostos deste documento.

**Veredito de prontidão:** Fase 1 e Fase 2A estão concluídas; a Fase 2 pública continua bloqueada pelos contratos de proposta versionada, convite oficial, reunião e autorização que ainda precisam ser implementados e comprovados.
