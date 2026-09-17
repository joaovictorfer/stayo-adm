# Arquitetura — Central Comercial e de Onboarding do Proprietário

Este documento evolui junto com as Fases 1–15 do plano de execução. Nesta
versão (fechamento da Fase 3) cobre: a fundação (como o Admin decide entre
persistência local e Supabase, papéis/auditoria), o proprietário como
entidade real, e a geração server-side do código da implantação.

## 1. Dois domínios, dois clients

- **Grupo B (Core)** — `src/lib/api/core-client.ts` / `CoreApiClient`.
  Property, Reservation, Guest, Owner (oficial), Contract, financeiro
  consolidado. Sempre somente leitura no Admin; nasce no STAYO.APP.
- **Grupo A (Admin)** — `src/lib/api/admin-client.ts` / `AdminApiClient`.
  Tudo que é próprio do relacionamento comercial: proprietário-prospect,
  pré-imóvel, implantação, condições comerciais, timeline, proposta, portal,
  convite, tarefa do proprietário, cobrança inicial, auditoria. Escreve de
  verdade — é o domínio que este plano constrói fase a fase.

Cada um tem exatamente o mesmo padrão de decisão mock-vs-real que o outro:
nenhuma tela verifica variável de ambiente; a fábrica (`createDefaultCoreApiClient`
/ `createDefaultAdminApiClient`) decide uma vez, num só lugar.

## 2. Como o `AdminApiClient` escolhe o adapter

```
createDefaultAdminApiClient()
  → isSupabaseConfigured() (lib/api/supabase-client.ts)
    true  → createSupabaseAdminApiClient()   (Postgres real, RLS)
    false → createLocalAdminApiClient()      (localStorage do navegador)
```

`isSupabaseConfigured()` verifica `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` (ver `.env.example`). Sem as duas, o app continua
funcionando exatamente como hoje — é o fallback seguro exigido pela Fase 0
para blocker de credencial externa inexistente.

Quando um projeto Supabase existir:

1. Rodar as migrations em `supabase/migrations/` (nesta fase, só `0001_admin_foundation.sql`
   — profiles/roles + audit_logs; as fases seguintes adicionam as próprias).
2. Criar o primeiro `admin_profiles` com papel `super_admin` manualmente
   (via SQL Editor do Supabase) para o primeiro usuário do time.
3. Definir `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no ambiente de
   deploy. Nenhuma mudança de código é necessária.

## 3. Papéis (`admin_role`)

`super_admin`, `admin`, `commercial`, `operations`, `finance`, `viewer` —
ver `supabase/migrations/0001_admin_foundation.sql`. A permissão é aplicada
via RLS no Postgres (`has_admin_role(...)`), nunca só escondendo item de
menu no frontend. Enquanto não há Supabase configurado, não há distinção de
papel no Admin local (mesmo comportamento de hoje) — isso é reavaliado
quando o login real (Fase 8, portal; auth do time interno fica para quando
houver credencial) entrar em produção.

## 4. Auditoria

`adminApi.audit.log(...)` grava em `audit_logs` (Postgres, RLS) ou na chave
local `stayo-admin:audit-logs` (fallback). Eventos são uma lista fechada em
`src/types/audit.ts` (`AuditEvent`) — nunca string livre. Visível em
`/configuracoes/auditoria`. Nesta fase já instrumentado em dois pontos:
mudança de status de implantação e aceite de proposta; as fases seguintes
adicionam os demais eventos (`owner.*`, `portal.*`, `charge.*`,
`core_conversion.*`) conforme essas ações passam a existir.

## 5. Por que o pré-imóvel não virou uma tabela separada (ainda)

O plano master descreve `implementation_properties` como entidade própria,
independente da implantação (um proprietário pode ter vários pré-imóveis).
Na Fase 3, os campos de pré-imóvel (apelido, condomínio, unidade, endereço,
CEP, cidade, tipo, quartos, capacidade) foram só enriquecidos dentro do
próprio `ImplementationProject` — não extraídos para uma entidade separada.

Motivo: hoje a relação é sempre 1:1 (cada implantação tem exatamente um
imóvel sendo implantado) e nenhuma tela ainda precisa endereçar um
pré-imóvel independente da sua implantação. Extrair a entidade agora seria
adicionar uma tabela e uma camada de indireção sem nenhum caso de uso
consumindo — vira dívida de abstração prematura. Isso é reavaliado quando
surgir a necessidade real (ex: um proprietário reabrindo implantação para
um imóvel que já teve uma implantação anterior, ou precisando cadastrar o
imóvel antes de decidir o responsável comercial).

## 6. Por que `implementations`/`guide`/`products` continuam no `CoreApiClient`

Tecnicamente pertencem ao domínio Admin (comentário original no arquivo já
diz isso), mas movê-los para `AdminApiClient` agora seria refatoração
mecânica de alto risco para zero mudança de comportamento — toda tela que
os usa teria que trocar de import. Adiado para quando essas entidades forem
reescritas de qualquer forma (Fases 3, 5 e 6 tocam `implementations`
diretamente) — a extração acontece então, junto com a mudança real, não
antes dela.
