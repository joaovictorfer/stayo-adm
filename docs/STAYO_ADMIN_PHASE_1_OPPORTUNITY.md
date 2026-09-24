# STAYO ADMIN — Fase 1: oportunidade comercial leve

Data da validação: 24/09/2026.

## Objetivo

Permitir que o time interno registre uma oportunidade antes de conhecer condomínio, unidade, endereço, documentos, dados bancários ou detalhes operacionais do imóvel.

Entrada mínima:

- nome do contato;
- telefone;
- título provisório.

A oportunidade permanece no domínio do STAYO ADMIN como `implementation_projects.status = prospect` e evolui na mesma ficha. Nenhum `Property` operacional do STAYO APP/Core é criado.

## Ambiente comprovado

- GitHub base da Fase 1: `main` em `1f1710c3720321fd1d2ddd4f2057e356dd19d5ab`.
- Lovable Cloud: projeto **Stayo Adm**, Project ID `696b2125-0bf9-4538-8458-05d88fc5e8a2`.
- Banco: PostgreSQL/Supabase provisionado pelo próprio Lovable Cloud desse projeto.
- O conector Supabase separado não foi usado.
- GitHub permaneceu como fonte de edição das migrations; o Lovable Cloud foi somente o ambiente de materialização do SQL versionado e de validação.

## Schema reutilizado

Não foi criada tabela de oportunidade.

`implementation_projects` já permite `NULL` para condomínio, unidade, endereço e demais dados de imóvel necessários apenas em fases posteriores. `nickname` é reutilizado como título provisório. `owner_records` aceita nome + telefone com e-mail/documento opcionais.

A oportunidade criada continua sendo o mesmo `implementation_projects` usado pela ficha existente, evitando uma entidade comercial paralela.

## Migrations materializadas

### 0017 — `supabase/migrations/0017_admin_opportunity_intake.sql`

Aplicada exatamente como versionada no Lovable Cloud.

Adiciona:

- `admin_find_owner_phone_duplicates(text)`;
- `admin_create_opportunity(jsonb)`.

A criação:

- valida nome, telefone e título no banco;
- cria `owner_records` como `prospect` quando nenhum contato existente é escolhido;
- aceita `existingOwnerId` somente quando o operador escolhe explicitamente um cadastro existente;
- cria `implementation_projects` como `prospect`;
- grava o título provisório em `nickname`;
- cria o vínculo em `implementation_owners`;
- gera `IMP-xxxxx` no servidor sob advisory lock e `UNIQUE(code)`;
- usa `requestId` + `origin=admin_opportunity:<uuid>` para idempotência;
- não cria condomínio, unidade, endereço ou detalhe operacional.

### 0018 — `supabase/migrations/0018_lock_down_opportunity_rpcs.sql`

Criada depois da validação pós-0017 detectar que o Lovable Cloud/Supabase adicionou grants diretos de `EXECUTE` para `anon` nas novas functions.

Aplicada exatamente como versionada.

Resultado efetivo:

- `authenticated`: `EXECUTE` nas duas RPCs;
- `anon`: sem `EXECUTE`;
- `service_role`/`postgres`: preservados como acesso interno.

### 0019 — `supabase/migrations/0019_harden_opportunity_rpc_authorization.sql`

Criada depois do teste de identidade detectar uma sutileza SQL: `has_admin_role(...)` retorna `NULL` quando `auth.uid()` não possui perfil administrativo; o guard original `IF NOT has_admin_role(...)` não rejeitava explicitamente esse `NULL`.

Aplicada exatamente como versionada.

As duas RPCs agora usam:

`has_admin_role(...) IS NOT TRUE`

portanto uma sessão autenticada sem papel permitido recebe erro explícito.

A 0017 já materializada não foi alterada.

## RLS e autorização comprovadas

Tabelas relevantes continuam com RLS habilitada.

Perfis permitidos para a criação leve:

- `super_admin`;
- `admin`;
- `commercial`.

Teste real com `super_admin` ativo:

- `auth.uid()` resolvido corretamente;
- `current_admin_role()` = `super_admin`;
- criação e busca permitidas.

Teste real com UUID autenticado sem `admin_profiles`:

- busca por telefone: rejeitada com `sem permissão para consultar contatos comerciais`;
- criação: rejeitada com `sem permissão para criar oportunidade`.

Teste como `anon`:

- `EXECUTE admin_find_owner_phone_duplicates`: permission denied;
- `EXECUTE admin_create_opportunity`: permission denied.

## Validação transacional no Lovable Cloud

Foi criada uma fixture sintética e removida ao fim dos testes.

### Criação mínima

O RPC criou um registro com:

- `status = prospect`;
- `nickname` igual ao título provisório;
- `condominium_id = NULL`;
- `unit = NULL`;
- `address = NULL`;
- owner prospect vinculado;
- código `IMP-*` gerado no banco.

### Idempotência / duplo clique

A mesma chamada com o mesmo `requestId` foi executada novamente e devolveu exatamente o mesmo `implementation_id` e `owner_id`.

No banco permaneceu:

- 1 owner para o telefone sintético;
- 1 implementation para o `origin` sintético.

### Persistência entre sessões

Uma segunda sessão autenticada do operador leu o mesmo `implementation_id`, título, owner e status do registro criado na primeira sessão.

Isso comprova persistência no Lovable Cloud e não em `localStorage`.

### Duplicidade por telefone

A busca com o mesmo número em formato brasileiro encontrou o owner sintético já persistido. Nenhum merge automático foi realizado.

### Efeitos colaterais

Baseline antes do teste:

- `admin_condominiums`: 1;
- `implementation_projects`: 4;
- `implementation_property_details`: 2;
- `owner_records`: 7.

Durante o teste:

- condomínio continuou em 1;
- a oportunidade não recebeu linha em `implementation_property_details`;
- não houve chamada para STAYO APP/Core e não existe criação de `Property` operacional nessa migration.

Depois da limpeza da fixture, o banco voltou para:

- `admin_condominiums`: 1;
- `implementation_projects`: 4;
- `implementation_property_details`: 2;
- `owner_records`: 7;
- 0 fixtures sintéticas remanescentes.

## UX implementada

A rota `/implantacao` passa a oferecer **Nova oportunidade** e formulário inicial apenas com:

1. nome do contato;
2. telefone;
3. título provisório.

O drawer:

- ocupa tela cheia abaixo de `sm`, portanto atende 375/390 px sem largura fixa excedente;
- usa `sm:w-[28rem]` no desktop/tablet;
- mantém conteúdo rolável verticalmente;
- mantém ações empilhadas no mobile e alinhadas em linha a partir de `sm`;
- possui estados loading, erro, disabled e prevenção de novo submit enquanto a mutation está pendente;
- pesquisa contato existente;
- sinaliza possíveis duplicidades pelo telefone normalizado;
- permite escolher um contato existente ou seguir com cadastro separado;
- não faz merge automático;
- só exibe sucesso após a criação e recarga do registro pelo banco.

A listagem mostra título, contato, etapa, responsável e próxima ação, preservando os registros já completos no mesmo dataset.

A validação responsiva pré-merge foi feita sobre o código efetivamente validado pelo build: 375/390 px usam o drawer `w-full` e layout vertical; a partir de `sm`, o drawer assume 28rem e ações horizontais. A listagem troca o cabeçalho tabular por linhas empilhadas no mobile (`sm:grid` apenas a partir do breakpoint). O preview visual do Lovable acompanha `main`, por isso a inspeção visual pixel-a-pixel da nova UI só pode ocorrer depois do merge/sincronização; isso deve ser tratado como validação pós-merge imediata, sem iniciar nova fase.

## Compatibilidade com registros existentes

Nenhuma coluna, enum ou tabela existente foi removida ou reinterpretada.

A apresentação usa esta ordem para título:

1. `nickname`;
2. condomínio + unidade;
3. código.

Registros antigos continuam abrindo e editando na mesma ficha e no mesmo adapter.

## Reunião

Não existe entidade persistente adequada de reunião no schema confirmado.

A Fase 1 não simulou reunião em `notes` ou `localStorage`. Reagendamento, histórico e exposição ao proprietário permanecem para a Fase 2.

## Histórico de migrations

A materialização desta fase ocorreu no Lovable Cloud executando exatamente os arquivos versionados no GitHub.

Não foi fabricada linha em `drizzle.__drizzle_migrations` nem alterado SQL histórico. A coexistência `drizzle/migrations` × `supabase/migrations` continua uma pendência de reconciliação global; para esta mudança, os arquivos Supabase 0017/0018/0019 são a trilha versionada e este documento registra sua execução real.

## Gate externo da Fase 2

`portal_content_blocks` permanece fora do escopo desta Fase 1 e continua sendo gate obrigatório antes da publicação externa da Fase 2.

## Rollback

Rollback de interface: remover/desabilitar a entrada **Nova oportunidade** por commit incremental.

Rollback de banco, se necessário, deve ser uma migration reversa explícita que remova/restrinja as RPCs; não editar migrations já aplicadas. O rollback não deve apagar oportunidades comerciais reais já criadas.
