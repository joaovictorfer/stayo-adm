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

## O que falta (documentado, não bloqueia o resto)

- **Owner Auth** (login do proprietário): ainda não existe. Hoje o acesso
  do proprietário ao próprio processo continua sendo só via link/token
  (convite de auto-cadastro, link da proposta) — nunca uma conta com
  senha vinculada a `auth.users`. Precisaria de: uma tabela
  `owner_portal_accounts` ligando `auth.users.id` a `owner_records.id`
  (ou a uma futura entidade `implementation_projects`), RLS em cada
  tabela que o proprietário deveria auto-ver restringindo por essa
  ligação, e uma tela de criação de senha depois do auto-cadastro. Não
  construído ainda — o auto-cadastro (Fase 8/16) continua funcionando
  sem isso, só sem "ver depois" sem o link.
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
