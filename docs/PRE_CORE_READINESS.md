# Pré-requisito Fase 19 — Verificação de prontidão das Fases 16–18

Exigido pelo prompt mestre "STAYO CORE + STAYO ADMIN OPERACIONAL" antes de
iniciar a Fase 19. Este documento não repete o conteúdo de
`docs/STAYO_ADMIN_PRODUCTION_REPORT.md` e `docs/PRODUCTION_READINESS.md` —
ele resume e emite um veredito objetivo com base neles.

## Veredito

**PARTIAL.**

Não é READY porque restam gaps reais e documentados (adapters locais em 4
verticais, upload/download HTTP nunca exercitados, cenário multi-dispositivo
completo bloqueado por credencial). Não é BLOCKED porque nenhum desses gaps
impede o início da Fase 19: a Fase 19 é uma auditoria do STAYO.APP
(repositório `joaovictorfer/stayoapp`, agora clonado em `/home/user/stayoapp`
e registrado nesta sessão), não depende de nenhuma credencial do Supabase do
Admin, e nada no restante do plano (Fases 20+) exige que os 4 adapters
locais já estejam trocados para começar — o próprio prompt mestre trata
"conectar ao Core" e "trocar adapter local→Supabase" como frentes paralelas,
não sequenciais.

## O que está pronto (evidência, não afirmação)

- Schema real aplicado e validado contra o Supabase de produção do Admin
  (`0001`–`0015`), RLS testada papel-a-papel com SQL real
  (`docs/RLS_MATRIX.md`), não apenas lida estaticamente.
- Autenticação real dos dois lados: time interno via Supabase Auth com gate
  de rota; proprietário via conta própria + RPC `owner_account_link`
  (Fase 17H).
- 10 verticais de dado com adapter Supabase real e testado:
  `owner_records`, condições comerciais, convite/auto-cadastro, outbox,
  `initial_charges` (idempotente sob concorrência real — Fase 17J),
  `admin_profiles`, `owner_portal_accounts`, `owner_tasks`, `attachments` +
  bucket privado `owner-attachments`.
- Suíte E2E real commitada (`e2e/`) rodando no CI: imutabilidade de versão
  de proposta, ciclo de vida do convite, ausência de segredo no bundle.
- CI verde no último estado conhecido; todo commit passou localmente por
  `tsc --noEmit`, `vitest run`, `eslint` (0 erros) e `vite build`.

## O que NÃO está pronto (gap explícito, não escondido)

- 4 verticais com schema/RLS prontos mas UI ainda lendo do mock local:
  `implementation_projects`/`items`, `proposals`/`share_links`,
  `checklist_templates`, `owner_notes` (motivo e plano em
  `docs/DATA_PERSISTENCE.md`).
- Código `IMP-xxxxx` (`nextSequentialCode` para implantação) ainda não tem
  o mesmo tratamento de `23505` aplicado a `COB-xxxxx` — só relevante quando
  o adapter de implantação for trocado para Supabase, o que nunca aconteceu
  ainda porque essa vertical só roda contra o `CoreApiClient` mock local.
- Fase 18 parcial: cenário completo de 30 passos admin↔owner com dois
  `browser.newContext()` reais contra o MESMO Supabase, e testes de
  concorrência com duas conexões paralelas reais — bloqueados pela mesma
  credencial externa.
- Upload/download reais via HTTP de `attachments` nunca exercitados (só a
  RLS em `storage.objects` foi validada via SQL direto).
- `signInWithPassword`/`signUp` nunca exercitados via HTTP real (nem time
  interno, nem proprietário) — só a lógica de RLS/RPC foi validada.

## Bloqueio externo único e permanente (não é um bloqueio da Fase 19)

`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` do projeto Lovable "Stayo Adm"
não estão disponíveis neste ambiente de build (Claude Code) — só o Lovable,
ao publicar, os injeta. Isso é ortogonal ao Core: é o Supabase PRÓPRIO do
Admin (domínio Grupo A), não tem relação com o Supabase do STAYO.APP
(domínio Core/Grupo B), que é auditado de forma inteiramente estática nesta
fase (leitura de repositório), sem precisar de nenhuma credencial de
runtime.

## Por que isso não impede a Fase 19

A Fase 19 pede uma auditoria de código/schema do STAYO.APP — leitura de
repositório, migrations, RLS, functions, rotas, integrações. Nada disso
depende do Admin estar 100% migrado do localStorage. As Fases 20+
(contrato Core v1, conexão Admin↔Core via BFF, conversão de implantação)
também não dependem disso: elas dependem de o STAYO.APP existir e ser
compreendido, o que é exatamente o objetivo da Fase 19. A troca dos 4
adapters locais restantes do Admin continua sendo trabalho legítimo e
pendente, mas paralelo, não bloqueante.

## Decisão

Prosseguir imediatamente para a Fase 19 (auditoria do STAYO.APP), sem
esperar a resolução dos gaps acima, que permanecem registrados e visíveis
em `docs/PRODUCTION_READINESS.md`.
