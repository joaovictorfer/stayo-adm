# E2E (Fase 18)

`bun run test:e2e` (Playwright, `playwright.config.ts` sobe o dev server
sozinho na porta 8235). Sempre com contextos de navegador genuinamente
isolados quando o teste simula mais de um dispositivo — nunca abas da
mesma sessão.

## O que esta suíte cobre agora

- **`proposal-immutability.spec.ts`** — um link de proposta v1 nunca
  passa a mostrar a v2 depois que ela é criada, e vice-versa; token
  inexistente nunca vaza qual proposta existe.
- **`invitation-lifecycle.spec.ts`** — convite de auto-cadastro
  inexistente/expirado/revogado/já usado/válido, cada um com a mensagem
  certa.
- **`secrets-in-bundle.spec.ts`** — builda o app de produção de verdade e
  varre `.output/public` procurando `service_role`/segredo — nunca deve
  aparecer no bundle que vai para o navegador.

Todos os três rodam contra o **adapter local** (sem Supabase configurado
neste ambiente) — são lógica de UI/cliente genuinamente testável sem
depender de credencial nenhuma.

## O que esta suíte NÃO cobre ainda (bloqueado por credencial externa)

O cenário completo da Fase 18A/C do plano mestre — dois
`browser.newContext()` de verdade, ambos falando com o MESMO projeto
Supabase real (admin cria convite no dispositivo A, proprietário abre no
dispositivo B, sem storage compartilhado), mais os testes de concorrência
real (duas conexões simultâneas de verdade gerando IMP/COB, dois aceites
de proposta ao mesmo tempo) e a validação HTTP de `signInWithPassword`
— continuam bloqueados por `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
ausentes neste ambiente. Ver `docs/MULTI_DEVICE_VALIDATION.md` para o que
foi validado como substituto (a mesma lógica de RPC exercitada via SQL
direto, simulando o papel `anon`) e `docs/SUPABASE_PRODUCTION_SETUP.md`
para o que falta para desbloquear isso de vez.
