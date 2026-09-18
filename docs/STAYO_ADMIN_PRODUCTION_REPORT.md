# Relatório de produção — Stayo Admin (Fases 16–17)

Respostas diretas às perguntas do prompt mestre. Nada aqui é otimista por
educação — onde a resposta é "não" ou "bloqueado", está escrito como tal.

**1. O Supabase está conectado?**
Sim, um projeto real existe e foi usado extensivamente para aplicar e
validar schema/RLS (via `mcp__Lovable__query_database`). O que NÃO está
conectado é este checkout de build (Claude Code) às credenciais públicas
do frontend — ver pergunta 18.

**2. Qual projeto/ref?**
Lovable Cloud, projeto "Stayo Adm", `project_id:
696b2125-0bf9-4538-8458-05d88fc5e8a2`, `workspace_id:
be3LovrbEIiRu9X0Pk2j`. Confirmado por correspondência de
`latest_commit_sha` com o SHA base deste branch no GitHub.

**3. Quais migrations foram aplicadas?**
`0001` a `0012`, todas em `supabase/migrations/`, todas aplicadas e
validadas contra o banco real nesta sessão (as mais recentes — `0009` a
`0012` — nesta própria passada). Lista completa com conteúdo:
`docs/SUPABASE_PRODUCTION_SETUP.md`.

**4. Quais tabelas existem?**
`admin_profiles`, `audit_logs`, `owner_records`,
`commercial_term_defaults`, `commercial_terms`, `owner_portal_invitations`,
`outbound_messages`, `initial_charges`, `owner_onboarding_submissions`,
`implementation_projects`, `implementation_items`, `proposals`,
`proposal_share_links`, `checklist_templates`, `owner_notes`. Mais duas
funções `security definer` por par (onboarding e proposta) para o
caminho público anônimo.

**5. A autenticação funciona?**
Sim, para os dois lados agora. Time interno: login/logout/sessão real via
Supabase Auth (`src/lib/auth/session.ts`), gate de rota (`__root.tsx`),
bootstrap seguro do primeiro `super_admin` (migration `0008`, bug real de
RLS encontrado e corrigido — ver `docs/AUTH_AND_ROLES.md`). Proprietário
(Fase 17H): conta própria (e-mail/senha) vinculada a `owner_records` via
o token do convite (`owner_account_link`, migration `0013`), com RLS de
leitura própria em `owner_records`/`implementation_projects`/`proposals`/
`initial_charges` — testado por isolamento entre dois proprietários
diferentes. **Não testado via HTTP real** em nenhum dos dois casos
(bloqueado por credencial — só a lógica de RLS e das RPCs foi exercitada
via SQL direto simulando papel/uid).

**6. Quais papéis existem?**
`super_admin`, `admin`, `commercial`, `operations`, `finance`, `viewer` —
enum `admin_role`, migration `0001`. Autorização real é sempre via RLS
(`has_admin_role(...)`), nunca decidida só no frontend.

**7. A RLS foi testada?**
Sim, extensivamente, com SQL real (não só leitura estática das policies)
simulando cada papel via `set local role`/`request.jwt.claims`. Matriz
completa, tabela por tabela, ação por ação, resultado observado:
`docs/RLS_MATRIX.md`. Cobre: papéis internos em todas as tabelas de
negócio, o caminho público anônimo (onboarding e proposta), o bootstrap
do primeiro admin, e a corrida de idempotência da cobrança inicial.

**8. O localStorage ainda contém dado de negócio?**
Sim, em duas categorias: (a) as verticais com schema pronto mas adapter
ainda local — `implementation_projects`/`items`, `proposals`/`share_links`,
`checklist_templates`, `owner_notes` (ver pergunta 9); (b)
`stayo-admin:audit-logs`, que fica fora do importador de propósito (a
policy de `insert` de `audit_logs` exige `actor_id = auth.uid()`, migrar
esse histórico específico precisaria de um script `service_role` fora do
browser). Mapa completo: `docs/LOCALSTORAGE_MIGRATION.md`.

**9. Quais adapters usam Supabase e quais não?**
Usam Supabase quando configurado: `owners`, `commercialTermDefaults`,
`commercialTerms`, `outbox`, `initialCharges`, `ownerOnboarding`, `audit`,
autenticação. Ainda só locais (schema pronto, adapter não trocado):
implantação/checklist (`CoreApiClient` mock), proposta/link de proposta,
templates de checklist, notas de proprietário. Detalhe tabela por tabela:
`docs/DATA_PERSISTENCE.md`.

**10. O portal funciona entre dispositivos diferentes?**
O caminho server-side (as duas RPCs `security definer`) foi validado como
dispositivo-agnóstico por construção — resolve/aceita um token sem
depender de nenhum estado do navegador que criou o convite. **Não foi
validado com dois navegadores/contextos reais** (bloqueado por
credencial). Detalhe completo, incluindo o que exatamente foi e não foi
provado: `docs/MULTI_DEVICE_VALIDATION.md`.

**11. O fluxo de proposta funciona entre dispositivos diferentes?**
Mesma resposta da pergunta 10, mesmo padrão de RPCs (`proposal_resolve_by_token`/
`proposal_accept_by_token`, migration `0010`). Adicionalmente: a UI de
proposta (`portal.proposta.$token.tsx`) ainda lê do mock local, não do
Supabase (ver pergunta 9) — então mesmo com credencial, o fluxo completo
ponta a ponta pela UI ainda não estaria testável sem primeiro trocar esse
adapter.

**12. O upload funciona?**
Construído (Fase 17I): bucket privado `owner-attachments` (nunca
público), tabela `attachments` com metadata, RLS testada tanto na tabela
quanto em `storage.objects` (o que o serviço de Storage de fato consulta
a cada upload/download) — proprietário só acessa a própria pasta,
isolamento confirmado entre dois proprietários diferentes. Cliente
(`src/lib/api/attachments.ts`) segue a API documentada do supabase-js.
**O que não foi validado**: upload/download reais via HTTP — mesma
credencial externa bloqueada do resto do domínio. Achado real no
processo: `storage.objects` bloqueia `delete` direto via SQL cru por
padrão (`storage.protect_delete()`) — só a API de Storage apaga um
objeto de verdade, proteção do próprio Supabase contra arquivo órfão.
Detalhe completo: `docs/DATA_PERSISTENCE.md` §Attachments.

**13. A cobrança é idempotente?**
Sim, e corrigida de verdade nesta sessão (Fase 17J): a constraint
`unique(proposal_id)` já garantia integridade, mas o adapter não tratava
a corrida — um duplo aceite simultâneo via cru um erro de
`unique_violation` em vez de devolver o registro já criado. Corrigido e
validado reproduzindo a colisão contra o banco real. Detalhe:
`docs/DATA_PERSISTENCE.md` §"Concorrência/idempotência de cobrança inicial".

**14. O código IMP é concorrência-segura?**
**Não ainda.** `nextSequentialCode` (`src/lib/sequential-code.ts`) nunca
foi concorrência-segura sozinho — só a constraint `unique` do banco evita
colisão de verdade. Para `initial_charges` (código `COB-xxxxx`) isso foi
corrigido nesta sessão. Para `implementation_projects` (código
`IMP-xxxxx`) o mesmo padrão de captura de `23505` ainda não foi aplicado,
porque a geração de IMP hoje só roda contra o mock local do
`CoreApiClient` (sem adapter Supabase, sem concorrência real possível —
JS de aba única). Fica registrado como pendência explícita para quando
esse adapter for trocado.

**15. A auditoria funciona?**
Sim — schema real (`audit_logs`), RLS exigindo `actor_id = auth.uid()`
(nunca aceita um ID arbitrário do cliente). Lista de eventos
(`AuditEvent`, `src/types/audit.ts`) foi cruzada com a lista do plano
mestre nesta sessão (Fase 17K) e completada: faltavam `auth.login` (agora
logado no login do time interno) e `readiness.override` (antes escondido
sob o evento genérico `timeline.item_updated`, agora com evento próprio).

**16. Qual o status do CI?**
Verde no último check conhecido (branch `claude/analysis-8sf0c0`). Cada
commit desta sessão passou localmente por `tsc --noEmit`, `vitest run`,
`eslint` (0 erros) e `vite build` antes do push.

**17. Qual o status dos testes E2E?**
Duas camadas. (a) Scripts manuais (Playwright ad hoc, um por mudança)
rodaram contra o adapter local ao longo de toda a sessão, cobrindo o gate
de autenticação, a tela de migração, e as telas tocadas em cada fase —
não commitados, só validação pontual antes de cada push. (b) Uma suíte
E2E de verdade, **commitada** em `e2e/` e rodando no CI
(`bun run test:e2e`, `.github/workflows/ci.yml`): imutabilidade de
versão de proposta (link da v1 nunca mostra a v2), ciclo de vida completo
do convite de auto-cadastro (inexistente/expirado/revogado/usado/válido),
e ausência de `service_role`/segredo no build de produção. As três
rodam contra o adapter local, sem depender de credencial — são lógica de
UI/cliente genuinamente testável assim. O que fica de fora: o cenário
completo de 30 passos admin↔owner com dois `browser.newContext()` reais
contra o MESMO Supabase, e os testes de concorrência com duas conexões
paralelas de verdade — bloqueados pela mesma credencial externa (ver
`e2e/README.md`).

**18. Quais os bloqueios externos?**
Um único, real, documentado desde o início: `VITE_SUPABASE_URL`/
`VITE_SUPABASE_ANON_KEY` não estão disponíveis para este ambiente de
build (Claude Code) — o Lovable as injeta automaticamente só quando ELE
mesmo builda e publica o projeto. Nenhuma credencial foi inventada em
lugar nenhum para contornar isso.

**19. O que está pronto para produção, e o que não está?**
Ver `docs/PRODUCTION_READINESS.md` para o checklist completo. Resumo:
time interno e proprietário (auth + RLS + 10 verticais de dado,
incluindo Owner Auth, Owner Tasks e Attachments) estão prontos para
produção assim que a credencial existir neste deploy; 4 verticais têm
schema/RLS prontos mas ainda leem do mock local (troca de adapter é o
próximo passo natural); o cenário multi-contexto completo da Fase 18, a
suíte de concorrência real, e o upload/download real via HTTP de
attachments seguem bloqueados pela mesma credencial externa (a parte que
não depende dela já está commitada em `e2e/` e roda no CI).
