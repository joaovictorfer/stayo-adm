# Onboarding do Proprietário — arquitetura do convite (Fase 8)

Cobre o **auto-cadastro do proprietário**: o formulário público que ele
preenche (nome, documento, e-mail, telefone, chave Pix) a partir de um link
gerado pelo time interno. Não confundir com o **portal de acompanhamento**
(`docs/OWNER_PORTAL.md`), que é uma tela diferente, com outro tipo de link.

## Onde vive

`ownerOnboardingStore` em `src/lib/api/local-store.ts` — hoje sempre local
(localStorage), nunca teve branch Supabase (ver
`docs/LOCALSTORAGE_MIGRATION.md`, seção "Schema pronto, adapter ainda
local"). O schema-alvo já existe em
`supabase/migrations/0004_owner_portal_invitations.sql`.

## O convite (`OwnerOnboardingLink`)

Tipo em `src/types/owner-onboarding.ts`. Regras, todas em
`ownerOnboardingStore`:

- **Token nunca em texto puro.** Só o hash SHA-256 (`src/lib/api/token-hash.ts`,
  `hashToken()`, via Web Crypto `crypto.subtle.digest`) é persistido. O valor
  bruto só existe transiente, no componente React, logo após a criação —
  nunca é lido de volta depois.
- **Expira em 7 dias** por padrão (`expiresAt`).
- **Gerar um novo convite revoga automaticamente qualquer um ainda ativo**
  da mesma implantação — nunca existem dois links válidos ao mesmo tempo.
- **Revogável a qualquer momento** pelo time interno.
- `ownerOnboardingLinkStatus()` (função pura, mesmo arquivo de tipos) deriva
  o status exibido (`ativo`/`expirado`/`revogado`/`usado`) a partir de
  `expiresAt`/`revokedAt`/`usedAt` — nunca um campo `status` solto que possa
  ficar dessincronizado dos timestamps.

## O envio do formulário (`OwnerOnboardingSubmission`)

Sem tabela Supabase própria ainda (ver `docs/LOCALSTORAGE_MIGRATION.md`).
Ao enviar, `ownerOnboardingStore.submit()` marca o convite como `usedAt` —
um convite usado nunca aceita um segundo envio.

## UI

- Time interno: painel "Cadastro do proprietário" em `implantacao.$id.tsx`
  (gera link, mostra status, revoga, mostra os dados recebidos assim que
  chegam).
- Proprietário: `src/routes/portal.implantacao.$token.tsx` — resolve o
  token por hash (`findByToken`), nunca por busca direta do valor puro;
  mostra mensagem específica para link expirado/revogado (não um genérico
  "link inválido").

## O que falta para produção real

Promover `ownerOnboardingStore` ao padrão `AdminApiClient` (local + adapter
Supabase lado a lado, como `owners`/`commercialTerms`/etc. em
`src/lib/api/admin-client.ts`) contra a tabela
`owner_portal_invitations` já pronta, e criar uma tabela própria para
`OwnerOnboardingSubmission`. Sem isso, mesmo com Supabase configurado para
o resto do app, este convite continua sendo local-only.
