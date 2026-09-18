# Segurança e RLS — Central Comercial e de Onboarding do Proprietário

Ver `docs/OWNER_IMPLEMENTATION_FINAL_REPORT.md` para o estado final de cada
fase e o que continua bloqueado por credencial externa ao fim da Fase 15.

## Credenciais

- **Nunca** `service_role` no bundle frontend. O browser só recebe a chave
  `anon`, protegida por RLS. Qualquer operação que precise de privilégio
  elevado (ex: gerar cobrança fiscal, revogar convite em massa) deve ir
  para uma função de borda/servidor com `service_role` isolada — nenhuma
  desta fase precisa disso ainda.
- `VITE_CORE_APP_TOKEN` (padrão pré-existente do Core) segue o mesmo
  princípio, mas hoje é só um placeholder — nenhum uso em produção real.
  Quando o Core real existir, o padrão correto é Browser → BFF/servidor do
  Admin → credencial privada → Core, nunca a credencial diretamente no
  browser (ver `docs/OWNER_IMPLEMENTATION_ARCHITECTURE.md`).

## RLS — papéis do time interno

`admin_profiles.role` é a fonte de verdade. `has_admin_role(...)` (SQL,
`security definer`) é o único jeito de checar papel dentro de política — não
duplicar a lógica em outra função. Nunca decidir permissão só no frontend
(esconder botão não é controle de acesso).

Regras já aplicadas (migration `0001_admin_foundation.sql`):

- `admin_profiles`: cada usuário só lê o próprio registro; `super_admin` lê
  e gerencia todos.
- `audit_logs`: qualquer papel do time interno pode inserir evento (sempre
  como si mesmo — `actor_id = auth.uid()`, nunca um ator arbitrário vindo
  do cliente); leitura restrita a `admin`/`super_admin`.

Regras que as fases seguintes precisam adicionar (não implementadas ainda,
porque as tabelas ainda não existem):

- `owner_records`/`implementation_projects` etc: leitura conforme papel
  (`commercial` vê comercial, `finance` vê cobrança, `viewer` só leitura).
- Portal do proprietário: proprietário só enxerga as próprias linhas —
  nunca via `owner_id` vindo do payload do cliente, sempre derivado de
  `owner_portal_accounts` ligado a `auth.uid()` da sessão.

## Dados sensíveis (LGPD)

- CPF/CNPJ, telefone, endereço, dados bancários, documentos: acesso
  restrito por RLS, nunca em log de auditoria em texto completo (só
  metadata operacional — ver `src/types/audit.ts`, comentário no
  `AuditLogEntry.metadata`).
- Separação obrigatória entre **o que o proprietário envia** (submission)
  e **o que vira dado operacional aprovado** (ex: Wi-Fi publicado no Guia).
  Implementada na Fase 8 (portal) — até lá, o único dado hoje submetido
  pelo proprietário (`OwnerOnboardingSubmission`) já não é exposto em
  nenhuma tela pública além do próprio Admin.
- PDF comercial nunca deve incluir dados bancários (Fase 7).

## O que ainda está bloqueado por credencial externa

- Projeto Supabase real (URL + chaves) — sem ele, tudo roda no adapter
  local, sem RLS de fato (é só JavaScript rodando no navegador do próprio
  usuário; não há "outro usuário" para isolar). Ver `.env.example`.
- Provider de WhatsApp real (Fase 9) — mock ativo por padrão.
- Provider de assinatura eletrônica / certificação de aceite (fora de
  escopo deste plano; aceite hoje é só registro auditável simples, não
  assinatura jurídica).
