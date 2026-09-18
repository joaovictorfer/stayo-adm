# Autenticação e papéis (Fase 17)

## Time interno

Autenticação real via Supabase Auth (`src/lib/auth/session.ts`) — igual a
todo o resto do app, só ativa quando `VITE_SUPABASE_URL`/
`VITE_SUPABASE_ANON_KEY` existem (`isSupabaseConfigured()`). Sem isso, o
Admin continua funcionando sem login, sobre o adapter local — mesmo
princípio de compatibilidade retroativa usado em toda vertical do
`AdminApiClient` desde a Fase 1.

### Gate de rota

`src/routes/__root.tsx` (`RootComponent`) — usa `useAuthSession()` e
redireciona para `/login` quando não há sessão, **exceto** em:

- `/portal/*` — portal público do proprietário (nunca autenticado).
- `/login` — a própria tela de entrada.

Este gate é só uma conveniência de UI (evita montar telas internas sem
sessão) — **nunca é a barreira de segurança real**. Quem decide o que
cada requisição pode ler/escrever é sempre a RLS no banco (ver
`docs/RLS_MATRIX.md`). Um gate de rota client-side pode ser contornado
por qualquer um que saiba o que está fazendo; a RLS, não.

### Bootstrap do primeiro administrador

Problema clássico: `admin_profiles` só aceita `insert` de quem já é
`super_admin` (migration `0001`) — ninguém é, na primeira vez que o
projeto sobe. A migration `0008_admin_auth_bootstrap.sql` resolve isso
com uma política extra: **só o primeiro usuário autenticado** pode se
auto-inserir, e só como `super_admin`; depois que existe uma linha,
nunca mais.

Armadilha real encontrada testando isto contra o banco de verdade (Lovable
Cloud conectado a este repositório): um `exists(select 1 from
admin_profiles)` cru dentro do `with check` é, ele mesmo, filtrado pelas
policies de SELECT da tabela — um segundo usuário (sem perfil ainda,
não-admin) não enxerga a linha do primeiro admin por causa das próprias
policies de leitura, então a tabela parece "vazia" do ponto de vista dele
e ele conseguiria se auto-inserir como super_admin também. Corrigido com
uma função `security definer` (`admin_profiles_is_empty()`, mesma técnica
de `has_admin_role()`), que enxerga a tabela real, sem o filtro de RLS do
chamador. Testado contra o banco real: primeiro usuário bootstrap
funciona; segundo usuário tentando o mesmo é rejeitado; um `super_admin`
já existente convidando alguém (`insert` normal, qualquer papel) continua
funcionando.

### Fluxo de UI (`src/routes/login.tsx`)

- **Entrar**: e-mail + senha via `signInWithPassword()`.
- **Criar o primeiro acesso**: e-mail + senha + nome via `signUp()`, que
  tenta o bootstrap logo depois. Se a tabela não estiver mais vazia, a
  conta no Supabase Auth é criada mesmo assim, mas a tela avisa que
  precisa ser liberada por um `super_admin` existente — nunca finge
  sucesso.
- `AccountMenu` (`AdminShell.tsx`) mostra nome + papel do usuário logado e
  um botão de sair; só aparece quando autenticado.

## Papéis (`admin_role`)

`super_admin | admin | commercial | operations | finance | viewer` —
enum criado na migration `0001`. Nenhuma tabela decide visibilidade só no
frontend: toda regra vive em `has_admin_role(...)` dentro de cada policy
RLS. Ver `docs/RLS_MATRIX.md` para a matriz completa, já testada contra o
banco real.

## Owner Auth (Fase 17H)

O proprietário agora pode ter conta própria (e-mail/senha via Supabase
Auth), vinculada a `owner_records` via `auth.uid()` — nunca mais só
link/token para "ver depois".

### Como o vínculo é provado

O problema real: nada ligava um `implementation_id` (usado no
convite/onboarding) a um `owner_id` de verdade no banco, exceto via
`implementation_projects.owner_id` — e essa tabela ainda não tem adapter
Supabase ligado (schema existe desde a Fase 17E, mas a UI continua lendo
do mock local, ver `docs/DATA_PERSISTENCE.md`). Em vez de fazer o Owner
Auth esperar essa troca de adapter, `owner_id` foi adicionado direto em
`owner_portal_invitations` (migration `0013`) — o admin já sabe o
proprietário no momento em que gera o convite (`adminApi.ownerOnboarding.createLink(implementationId, ownerId)`),
então gravar isso ali resolve a dependência sem esperar nada.

### Fluxo (`src/lib/auth/owner-session.ts`, `portal.implantacao.$token.tsx`)

Depois de enviar o auto-cadastro, o proprietário pode criar uma senha
(e-mail/senha via `signUp()`), e o MESMO token do convite prova o vínculo
via a função `security definer` `owner_account_link(p_token)` (migration
`0013`) — nunca um `insert` direto em `owner_portal_accounts` pelo
cliente (a tabela só aceita `insert` por essa função). A função revalida
tudo server-side (token existe, não revogado, não expirado, tem
`owner_id`) e é idempotente: chamar de novo com o mesmo token/usuário
devolve a conta já vinculada, sem erro.

### RLS de leitura própria

Com `owner_portal_accounts` vinculada, o proprietário passa a poder ler
(nunca escrever) diretamente, sob RLS, o próprio: `owner_records`,
`implementation_projects` (por `owner_id`), `proposals` (via join a
`implementation_projects`), `initial_charges` (por `owner_id`). Escrita
continua só pelas RPCs `security definer` já existentes
(`owner_onboarding_submit`, `proposal_accept_by_token`) — nunca um
`update`/`insert` direto sob a sessão do proprietário.

Testado contra o banco real (ver `docs/RLS_MATRIX.md`): conta vinculada
via RPC; um segundo proprietário (`owner_id` diferente) não enxerga nada
do primeiro em nenhuma das quatro tabelas; token expirado, revogado ou
sem `owner_id` são rejeitados com a mensagem certa; vínculo duplicado
(mesmo token, mesmo usuário) é idempotente.

### O que ainda falta (documentado, não bloqueia o resto)

- **Owner Tasks/Attachments**: RLS de leitura própria cobre hoje só as
  quatro tabelas acima — não existe ainda pendência ("Precisamos de
  você") nem anexo/documento para o proprietário ver (conceitos novos,
  não construídos, ver `docs/DATA_PERSISTENCE.md`).
- **Teste E2E de `signUp`/login do proprietário via HTTP real**:
  bloqueado pela mesma credencial externa do time interno — só a RPC
  `owner_account_link` e a RLS resultante foram validadas via SQL direto.
- **Gate server-side**: o gate de rota atual é só client-side
  (`useEffect` depois de montar). Uma versão mais robusta leria o cookie
  de sessão do Supabase dentro do loader/SSR da rota, antes de renderizar
  qualquer HTML protegido — não construído ainda, para não alongar mais
  esta fase; o gate atual já evita o caso comum (usuário deslogado vendo
  a tela por engano), só não é hermético contra alguém inspecionando a
  resposta SSR bruta.
- **Teste E2E de login de verdade**: bloqueado por credencial externa —
  este ambiente não tem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, só
  acesso a SQL direto (usado para validar toda a RLS e o bootstrap, ver
  `docs/RLS_MATRIX.md`). O fluxo de `signInWithPassword`/`signUp` em si
  (chamadas HTTP ao endpoint de Auth do Supabase) não pôde ser exercitado
  ponta a ponta aqui.
