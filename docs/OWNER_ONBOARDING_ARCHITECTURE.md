# Onboarding do Proprietário — arquitetura do convite (Fase 8, promovido na Fase 16)

Cobre o **auto-cadastro do proprietário**: o formulário público que ele
preenche (nome, documento, e-mail, telefone, chave Pix) a partir de um link
gerado pelo time interno. Não confundir com o **portal de acompanhamento**
(`docs/OWNER_PORTAL.md`), que é uma tela diferente, com outro tipo de link.

## Onde vive

`adminApi.ownerOnboarding` em `src/lib/api/admin-client.ts` — mesmo padrão
local+Supabase do resto do `AdminApiClient`
(`createDefaultAdminApiClient()` escolhe sozinho). Até a Fase 15 vivia em
`ownerOnboardingStore` (`local-store.ts`), sempre local, porque o caminho
público exigia RLS incompatível com um visitante anônimo — ver a seção
"O caminho público" abaixo para como isso foi resolvido.

## O convite (`OwnerOnboardingLink`)

Tipo em `src/types/owner-onboarding.ts`. Regras, implementadas nos dois
adapters de `adminApi.ownerOnboarding`:

- **Token nunca em texto puro.** Só o hash SHA-256 (`src/lib/api/token-hash.ts`,
  `hashToken()`, via Web Crypto `crypto.subtle.digest`) é persistido. O valor
  bruto só existe transiente, no componente React, logo após a criação —
  nunca é lido de volta depois. No banco (migration `0004`), a coluna
  `token_hash` guarda exatamente esse hash.
- **Expira em 7 dias** por padrão (`expiresAt`).
- **Gerar um novo convite revoga automaticamente qualquer um ainda ativo**
  da mesma implantação — nunca existem dois links válidos ao mesmo tempo.
- **Revogável a qualquer momento** pelo time interno.
- `ownerOnboardingLinkStatus()` (função pura, mesmo arquivo de tipos) deriva
  o status exibido (`ativo`/`expirado`/`revogado`/`usado`) a partir de
  `expiresAt`/`revokedAt`/`usedAt` — nunca um campo `status` solto que possa
  ficar dessincronizado dos timestamps.

## O envio do formulário (`OwnerOnboardingSubmission`)

Tabela `owner_onboarding_submissions` (migration
`0007_owner_onboarding_submissions.sql`), `implementation_id unique` — um
envio por implantação. Ao enviar, marca o convite como `usedAt` —
um convite usado nunca aceita um segundo envio.

## O caminho público — por que precisou de funções `security definer`

`getLink`/`createLink`/`revoke`/`getSubmission` são chamados só pela tela
autenticada do time interno — leitura/escrita direta sob RLS, igual a
qualquer outra vertical de `AdminApiClient`.

`findByToken`/`submit`, porém, são chamados por `portal.implantacao.$token.tsx`
— uma rota **pública, sem sessão autenticada**. As RLS de
`owner_portal_invitations`/`owner_onboarding_submissions` exigem papel do
time interno (`has_admin_role(...)`), então um visitante anônimo nunca
conseguiria ler ou escrever essas tabelas diretamente — é exatamente esse
descompasso que travou a promoção deste vertical até a Fase 15.

A solução (migration `0007`): duas funções Postgres `security definer`
(rodam com privilégio elevado, mas só fazem exatamente o que a validação
client-side já fazia):

- `owner_onboarding_resolve_token(token)` — hash do token (mesmo SHA-256
  hex minúsculo do cliente) e devolve só os campos públicos do convite
  (`implementation_id`, `expires_at`, `used_at`, `revoked_at`) — nunca o
  `token_hash` nem qualquer outra coluna.
- `owner_onboarding_submit(token, ...)` — revalida tudo server-side
  (convite existe, não revogado, não usado, não expirado) antes de gravar
  o envio e marcar o convite como usado, atomicamente (`for update` trava
  a linha, então duas tentativas simultâneas com o mesmo token nunca
  conseguem duplicar o envio).

Ambas com `grant execute ... to anon, authenticated` — só a função é
exposta ao público, nunca a tabela. Testado de ponta a ponta contra um
projeto Supabase real (ver `docs/LOCALSTORAGE_MIGRATION.md` §"Validação
contra um projeto Supabase real"): token válido, token já usado, convite
revogado e convite expirado — os quatro casos rejeitam/aceitam
corretamente.

## UI

- Time interno: painel "Cadastro do proprietário" em `implantacao.$id.tsx`
  (gera link, mostra status, revoga, mostra os dados recebidos assim que
  chegam).
- Proprietário: `src/routes/portal.implantacao.$token.tsx` — resolve o
  token por hash (`findByToken`), nunca por busca direta do valor puro;
  mostra mensagem específica para link expirado/revogado (não um genérico
  "link inválido").

## O que falta para produção real

Owner Auth de verdade (§23 do plano de produção): depois do envio do
formulário, o proprietário ainda não cria uma conta com senha vinculada a
`auth.users` — hoje o acesso continua sendo só pelo link/token. Ver
`docs/AUTH_AND_ROLES.md` para o estado da autenticação do time interno
(que existe) e o que falta para a do proprietário (que não existe ainda).
