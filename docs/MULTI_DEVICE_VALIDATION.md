# Validação multi-dispositivo — estado real

O prompt mestre exige um teste **obrigatório**: admin cria um convite no
dispositivo A, proprietário abre no dispositivo B, com zero storage
compartilhado. Este documento separa honestamente o que foi validado do
que está bloqueado, em vez de fingir uma cobertura que não existe.

## O que impede o teste completo hoje

O teste de verdade (dois `browser.newContext()` do Playwright, sem
`localStorage`/cookies compartilhados, ambos falando com o MESMO projeto
Supabase real) precisa de `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
configuradas neste ambiente de build — que não existem aqui (ver
`docs/SUPABASE_PRODUCTION_SETUP.md`, `BLOCKED_EXTERNAL_CREDENTIAL`). Sem
isso, `isSupabaseConfigured()` é sempre falso e todo `AdminApiClient` cai
no adapter local (`localStorage`) — dois contextos de navegador isolados
nunca veriam o mesmo dado, porque não há banco compartilhado nenhum para
eles conversarem.

## O que FOI validado, e por que isso ainda é uma evidência real

Em vez de simular o dispositivo B com um navegador (impossível sem a
credencial), o **caminho server-side que o dispositivo B percorreria**
foi exercitado diretamente contra o banco Supabase real, simulando
exatamente o papel `anon` que um navegador sem sessão usaria
(`set local role anon`, sem nenhum `request.jwt.claims` — ver
`docs/RLS_MATRIX.md`):

- Um convite criado (linha em `owner_portal_invitations`, papel
  `commercial`/time interno — o "dispositivo A") foi resolvido com
  sucesso via `owner_onboarding_resolve_token(token)` sob o papel `anon`
  — sem nenhuma sessão, sem nenhum dado compartilhado com quem criou o
  convite além do próprio token na URL. Isso é exatamente a mesma
  chamada que `portal.implantacao.$token.tsx` faz de qualquer navegador,
  em qualquer dispositivo.
- O envio do formulário (`owner_onboarding_submit`) sob `anon` foi
  aceito, marcou o convite como usado, e um segundo envio com o mesmo
  token foi corretamente rejeitado — provando que o estado "usado" fica
  no banco (visível a partir de qualquer dispositivo que resolva o mesmo
  token depois), nunca em `localStorage` do dispositivo que enviou.
- O mesmo padrão foi validado para o fluxo de proposta
  (`proposal_resolve_by_token`/`proposal_accept_by_token`, migration
  `0010`, Fase 17G) — incluindo o aceite idempotente (segundo aceite com
  nome diferente não sobrescreve o primeiro).

Isso prova que a **lógica de servidor é dispositivo-agnóstica por
construção**: nada no caminho público depende de `localStorage`,
`sessionStorage`, cookie ou qualquer estado do navegador que criou o
convite — só o token na URL e o banco. Não é o mesmo que rodar dois
navegadores de verdade, mas é uma evidência real de que a arquitetura
correta está implementada, não uma alegação vazia.

## O que ainda falta, explicitamente

- O teste E2E com dois `browser.newContext()` de verdade, de ponta a
  ponta, contra um Supabase com credencial configurada (Fase 18A/B do
  plano mestre) — não executado ainda, depende da credencial.
- Validação de que a UI (não só a chamada RPC crua) se comporta bem no
  dispositivo B — carrega o formulário, mostra erro correto para token
  usado/expirado/revogado, etc. Hoje isso só foi validado via Playwright
  contra o **adapter local** (mesmo dispositivo, sem Supabase) — ver os
  scripts de E2E rodados ao longo das Fases 8/16.
