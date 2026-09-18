# Portal do Proprietário — telas públicas sem autenticação

Duas telas públicas, cada uma resolvida por um **token diferente, com regras
diferentes**. Nenhuma delas precisa de login — o token na URL é o único
segredo, sempre validado por hash, nunca em texto puro.

## `portal.implantacao.$token.tsx` — acompanhamento + auto-cadastro

- Token vem de `ownerOnboardingStore` (ver
  `docs/OWNER_ONBOARDING_ARCHITECTURE.md`) — expira em 7 dias, é revogável,
  e nasce sempre único por implantação (gerar um novo revoga o anterior).
- Mostra o formulário de auto-cadastro enquanto não houver envio; depois do
  envio, mostra confirmação e passa a ser "usado" — não aceita um segundo
  preenchimento pelo mesmo link.

## `portal.proposta.$token.tsx` — proposta comercial + aceite + cobrança

- Token vem de `proposalShareStore` (`src/lib/api/local-store.ts`) e é
  **fixo por versão de proposta** — nunca "a versão mais recente da
  implantação" (ver `docs/PROPOSALS.md`). Um link gerado para a v1 nunca
  passa a mostrar a v2, mesmo depois de uma v2 existir.
- Fluxo: mostra os itens e o total da versão → permite baixar o PDF →
  aceite (nome + "li e concordo", nunca assinatura jurídica) → depois de
  aceita, mostra a cobrança inicial gerada (ver `docs/INITIAL_CHARGES.md`)
  com status e valor.
- O aceite dispara `initialCharges.createFromProposal` só se a implantação
  tiver condições comerciais `fixed_once` — idempotente por `proposalId`
  (aceitar duas vezes, ou recarregar a página depois de aceitar, nunca
  duplica a cobrança).

## Separação entre dado privado e dado público

Nenhuma das duas telas expõe:

- Dado bancário completo ou documento (CPF/CNPJ) além do que o próprio
  proprietário acabou de digitar no formulário de auto-cadastro (nunca
  mostrado de volta na tela da proposta).
- Anotações internas do time (`ownerNotesStore`, "Central do Proprietário"
  no Admin) — essas só existem no Admin autenticado, nunca em rota pública.
- Auditoria (`audit_logs`/`stayo-admin:audit-logs`) — só em
  `/configuracoes/auditoria`, dentro do Admin.

## Multi-dispositivo, hoje

`proposalShareStore`/`proposalsStore` ainda são local-only (ver
`docs/LOCALSTORAGE_MIGRATION.md`) — o link funciona em qualquer navegador
porque o token por si só resolve a proposta certa a partir do snapshot
salvo, mas **o dado em si só existe de verdade no navegador de quem criou a
implantação** até haver um projeto Supabase real. Isso é um gap conhecido,
não um bug: aceitar em "outro dispositivo" já funciona architeturalmente
(o token, o hash, a resolução por versão — tudo pronto), falta só o backend
compartilhado.
