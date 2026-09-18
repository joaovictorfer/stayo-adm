# Cobrança Inicial (Fase 10)

**Não é nota fiscal.** Representa só o valor devido, uma vez, quando a
proposta é aceita — a emissão fiscal em si é um tópico fora de escopo deste
plano (precisaria de um provider de NF real, nunca fabricado).

## Como nasce

`portal.proposta.$token.tsx`, na mutação de aceite: se a implantação tiver
condições comerciais `chargeType === "fixed_once"` (ver
`docs/COMMERCIAL_TERMS.md`), chama
`adminApi.initialCharges.createFromProposal({ implementationId, ownerId,
proposalId, items })`. Nenhuma tela calcula o valor total — o adapter soma
`items.reduce(...)`.

## Idempotência

Por `proposalId`, em duas camadas:

- **App**: `createFromProposal` procura uma cobrança existente com o mesmo
  `proposalId` antes de criar; se encontrar, retorna a mesma (nunca cria de
  novo). Cobre reload da página, duplo clique, aceite reprocessado.
- **Banco**: `initial_charges.proposal_id unique`
  (`supabase/migrations/0006_initial_charges.sql`) — mesmo que a checagem
  da app falhasse por uma corrida entre duas abas, o banco rejeitaria a
  segunda inserção.

Consequência prática: **aceitar a mesma versão de proposta duas vezes nunca
duplica cobrança**, e criar uma v2 da proposta e aceitá-la gera uma
**cobrança nova e distinta** (chave por `proposalId`, não por
`implementationId`) — se a v1 já tinha sido aceita e cobrada, a v2 aceita
depois gera sua própria cobrança independente.

## Código (`COB-00001`)

Mesma regra do código de implantação — `nextSequentialCode("COB", ...)`
(`src/lib/sequential-code.ts`), calculado no adapter a partir do estado
persistido, nunca no componente.

## Status e ciclo

`InitialChargeStatus`: `draft | issued | pending | paid | cancelled |
overdue`. Nasce sempre `pending`. O time interno só transiciona o status
(`updateStatus()`, painel "Cobrança inicial" em `implantacao.$id.tsx`) —
nunca cria ou edita o valor manualmente, ele só existe como consequência de
uma proposta aceita.

## Visibilidade

- Proprietário: vê a cobrança (itens, valor, status) na mesma tela onde
  aceitou a proposta (`portal.proposta.$token.tsx`).
- Time interno: painel dedicado na ficha da implantação, com histórico de
  todas as cobranças já geradas para aquela implantação.

## Persistência

`initial_charges` já migrada (ver `docs/LOCALSTORAGE_MIGRATION.md`) — RLS
restrita a `super_admin`/`admin`/`finance` (leitura e escrita).
