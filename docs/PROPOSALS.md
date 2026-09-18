# Propostas — versionamento, PDF e aceite

## Versionamento real (Fase 6)

`proposalsStore` (`src/lib/api/local-store.ts`) — cada "salvar" cria uma
**nova versão**, nunca sobrescreve a anterior. `Proposal.version` é
sequencial por implantação. A versão aceita (`acceptedAt`/`acceptedName`)
nunca é editável de novo — `ProposalTab` sempre edita a partir de um rascunho
derivado da última versão, mas salvar gera `version + 1`.

## Link público é por versão, não por implantação

Esta foi a correção mais importante da Fase 6 (bug real encontrado na
auditoria da Fase 0): `ProposalShareLink` é chaveado por `proposalId`
(uma versão específica), não por `implementationId`. Consequência prática:
um link enviado para a v1 **continua mostrando a v1 para sempre**, mesmo
depois de uma v2 existir. Para compartilhar a v2, é preciso gerar um novo
link (`ShareLinkPanel`/`proposalShareStore.createLinkForProposal`,
idempotente por `proposalId` — gerar duas vezes reaproveita o mesmo token).

Validado em E2E (ver histórico de commits da Fase 14): criar v2 depois de
um link da v1 já existir, e confirmar que reabrir o link da v1 nunca mostra
o item exclusivo da v2.

## PDF (Fase 7)

`src/lib/pdf/proposal-pdf.ts` — `pdf-lib` puro (zero dependência nativa,
compatível com o alvo Cloudflare Workers). Nasce sempre do snapshot
imutável de uma versão específica (mesmo princípio do link). Nunca inclui
dado bancário completo. Inclui: capa (código, proprietário, imóvel, versão,
validade), itens com total, condições recorrentes (percentual/mensal/por
reserva — nunca somadas ao total da proposta, só informativas) e o link do
portal. Dois pontos de entrada geram o mesmo PDF: aba Proposta (Admin) e
portal público.

## Aceite

Formulário simples: nome completo + checkbox "Li e concordo" — **não é
assinatura jurídica**, é um registro auditável de concordância comercial
(texto explícito na tela, para não criar falsa expectativa legal).
Registra `proposal.accepted` em auditoria e, se houver condições
`fixed_once`, dispara a cobrança inicial (ver `docs/INITIAL_CHARGES.md`).

## O que falta para produção real

`proposalsStore`/`proposalShareStore` ainda não têm adapter Supabase (ver
`docs/LOCALSTORAGE_MIGRATION.md`) — tudo acima funciona architeturalmente
(token por hash conceitual via UUID do link, resolução por versão fixa,
idempotência), mas o dado em si só existe no navegador de quem criou a
proposta até essas tabelas existirem.
