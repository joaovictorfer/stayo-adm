# STAYO ADMIN — Fase 1: oportunidade comercial leve

Data da auditoria: 24/09/2026.

## Objetivo

Permitir que o time interno registre uma oportunidade antes de conhecer condomínio, unidade, endereço, documentos, dados bancários ou detalhes operacionais do imóvel.

Entrada mínima:

- nome do contato;
- telefone;
- título provisório.

A oportunidade permanece no domínio do STAYO ADMIN como `implementation_projects.status = prospect` e evolui na mesma ficha. Nenhum `Property` operacional do STAYO APP/Core é criado.

## Baseline confirmado antes da mudança

- GitHub `main`: `1f1710c3720321fd1d2ddd4f2057e356dd19d5ab`.
- Lovable: projeto **Stayo Adm**, ID `696b2125-0bf9-4538-8458-05d88fc5e8a2`, sincronizado com o mesmo SHA no início da execução.
- Banco consultado: Lovable Cloud habilitado nesse Project ID.
- O conector Supabase separado da sessão enxerga apenas o projeto `jsxwyewasvcxkgbpbdvk`; ele NÃO é o banco do Stayo Admin e não foi usado para DDL.
- O banco Lovable Cloud do Admin apresenta histórico `drizzle.__drizzle_migrations` até a migration Drizzle `0015` (id 28). A contenção Drizzle `0016` não aparece como aplicada.

## Schema reutilizado

Não foi criada tabela de oportunidade.

`implementation_projects` já permite como `NULL`:

- `condominium_id` / `condominium_name`;
- `tower` / `unit`;
- `address` / `postal_code` / `city`;
- `property_type` / `bedrooms` / `capacity`;
- `responsible_user_id`;
- `core_property_id` / `core_owner_id`.

`nickname` é reutilizado como título provisório enquanto não existe identificação mais completa do imóvel. Registros existentes continuam usando o mesmo campo como apelido.

`owner_records` já aceita nome + telefone, mantendo e-mail/documento opcionais.

## Blocker remoto encontrado

O schema comporta uma oportunidade leve, mas o RPC produtivo `admin_create_implementation(p_data jsonb)` exige hoje:

- `ownerId`;
- `condominiumName`;
- `unit`.

Ele já gera `IMP-xxxxx` corretamente no servidor com `pg_advisory_xact_lock` e `UNIQUE(code)`. A Fase 1 não substitui esse RPC porque ele continua necessário para compatibilidade com o fluxo legado.

A migration nova adiciona um RPC separado e específico `admin_create_opportunity`.

## Migration 0017

Arquivo: `supabase/migrations/0017_admin_opportunity_intake.sql`.

Ela adiciona:

### `admin_find_owner_phone_duplicates(text)`

- `SECURITY INVOKER`;
- exige papel `super_admin`, `admin` ou `commercial`;
- normaliza telefone brasileiro;
- retorna candidatos existentes para decisão humana;
- não faz merge automático;
- `EXECUTE` removido de `PUBLIC` e concedido somente a `authenticated`.

### `admin_create_opportunity(jsonb)`

- `SECURITY INVOKER`;
- exige `super_admin`, `admin` ou `commercial`;
- valida nome, telefone e título no banco;
- aceita `existingOwnerId` somente quando o operador explicitamente escolhe um contato existente;
- caso contrário cria novo `owner_records` como `prospect`;
- não usa nome como identidade;
- não cria condomínio;
- não cria unidade;
- não cria `Property` operacional;
- não cria dados de acesso/Wi-Fi, repasse ou contrato;
- cria `implementation_projects` como `prospect`, com o título em `nickname`;
- mantém `implementation_owners` como vínculo principal;
- gera código no banco sob lock transacional;
- usa `requestId` + advisory lock + `origin=admin_opportunity:<uuid>` para tornar retries/duplo clique idempotentes.

## RLS e autorização confirmadas

No banco atual:

- `owner_records`: INSERT/UPDATE somente `super_admin`, `admin`, `commercial`;
- `implementation_projects`: gestão por `super_admin`, `admin`, `commercial`, `operations`;
- `implementation_owners`: gestão por `super_admin`, `admin`, `commercial`, `operations`.

A criação leve adota o limite mais restritivo de `owner_records`: `super_admin`, `admin`, `commercial`. Um usuário apenas de operações não ganha permissão nova por causa do RPC.

## UX implementada na branch

A área `/implantacao` passa a ter CTA **Nova oportunidade** e um formulário inicial apenas com:

1. nome do contato;
2. telefone;
3. título provisório.

O formulário:

- verifica possíveis duplicidades pelo telefone normalizado;
- deixa o operador escolher um contato existente ou criar registro separado;
- nunca faz merge automático;
- define o usuário logado como responsável inicial quando disponível;
- bloqueia duplo envio enquanto a mutation está pendente;
- usa um `requestId` estável por tentativa para idempotência também no servidor;
- só mostra sucesso depois de receber a oportunidade do banco e recarregá-la pela API.

A listagem passa a priorizar título, contato, etapa, responsável e próxima ação sem perder registros antigos.

## Compatibilidade com registros existentes

Nenhuma coluna, enum ou tabela existente foi removida ou reinterpretada.

A apresentação usa esta ordem para título:

1. `nickname`;
2. condomínio + unidade;
3. código da oportunidade.

Assim, implantações antigas que não possuem `nickname` continuam identificáveis pelo condomínio/unidade.

## Continuação progressiva

A oportunidade criada é o próprio `implementation_projects` já usado pela ficha atual. Portanto owner, endereço, cidade, condições comerciais, checklist e demais módulos continuam vinculados ao mesmo `implementation_id`.

A ficha existente ainda possui lacunas de UX para edição de alguns campos cadastrais (por exemplo condomínio/unidade) que precisam ser tratadas incrementalmente sem criar outro cadastro. A Fase 1 não cria uma segunda entidade para resolver isso.

## Reunião

Não foi encontrada no banco correto qualquer tabela/RPC de reunião, meeting, appointment ou schedule.

A reunião opcional NÃO foi simulada em `notes`, `localStorage` ou campos sem contrato. A persistência estruturada de reunião permanece pendente para a Fase 2 / migration própria depois que o fluxo de migrations estiver liberado.

## Coexistência Drizzle × Supabase

O banco real registra aplicações em `drizzle.__drizzle_migrations`, enquanto o repositório também contém `supabase/migrations/0001..0016`.

Para esta fase:

- nenhuma migration histórica foi reaplicada;
- nenhuma linha de histórico foi fabricada;
- a mudança nova foi versionada somente como `supabase/migrations/0017_admin_opportunity_intake.sql`, seguindo a direção futura documentada após reconciliação;
- a migration 0017 NÃO está considerada aplicada até existir evidência no Lovable Cloud correto.

## Gate de aplicação

O conector Supabase disponível nesta sessão não possui o banco Lovable Cloud do Stayo Admin. E o Lovable é ferramenta de consulta/preview, não canal autorizado de edição de banco.

Portanto a migration 0017 está **PENDENTE DE APLICAÇÃO CONTROLADA**.

Enquanto o RPC não existir no banco, o frontend retorna um erro explícito informando que a criação leve ainda não foi habilitada. Não há fallback para mock/localStorage.

## P0 da Fase 2

Continua aberto e fora do escopo desta implementação: `portal_content_blocks` ainda possui leitura anônima por policy `SELECT USING (true)` e grants para `anon` no banco consultado.

Isso não é corrigido pela Fase 1 e segue como gate antes de qualquer publicação externa da Fase 2.

## Rollback

Antes de aplicar a migration, rollback = não fazer merge/deploy da branch.

Depois de aplicada, rollback funcional pode desabilitar/remover a entrada UI e restaurar o fluxo anterior; eventual remoção dos dois RPCs exige migration reversa explícita. Os dados de oportunidade já criados não devem ser apagados em rollback automático.
