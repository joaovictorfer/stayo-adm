# STAYO ADMIN — Validação final da Fase 1

Data: 24/09/2026

## Estado final

A Fase 1 de oportunidade comercial leve foi implementada, materializada no Lovable Cloud do projeto **Stayo Adm** (`696b2125-0bf9-4538-8458-05d88fc5e8a2`), validada e mergeada na `main` pela PR #29.

Merge da PR #29: `55029b16b23c29b3fbb6eb839d30d91966a395ea`.

## Banco e segurança

Foram aplicadas exatamente as migrations versionadas:

- `supabase/migrations/0017_admin_opportunity_intake.sql`;
- `supabase/migrations/0018_lock_down_opportunity_rpcs.sql`;
- `supabase/migrations/0019_harden_opportunity_rpc_authorization.sql`.

Estado comprovado após aplicação:

- `admin_create_opportunity(jsonb)` existe;
- `admin_find_owner_phone_duplicates(text)` existe;
- `authenticated` possui `EXECUTE` nas duas RPCs;
- `anon` não possui `EXECUTE`;
- as duas RPCs rejeitam explicitamente sessão autenticada sem papel administrativo permitido;
- operador `super_admin` autorizado consegue usar o fluxo;
- RLS das tabelas relevantes permanece habilitada.

## Teste transacional

Fixture sintética temporária criada e removida ao final.

Comprovado:

- criação apenas com nome, telefone e título provisório;
- `status = prospect`;
- `condominium_id`, `unit` e `address` permanecem `NULL`;
- código `IMP-*` é gerado no servidor;
- repetição com o mesmo `requestId` retorna o mesmo registro;
- segunda sessão autenticada lê o mesmo registro persistido;
- busca pelo telefone normalizado localiza o contato existente sem merge automático;
- nenhum condomínio foi criado;
- nenhum `implementation_property_details` foi criado para a oportunidade;
- nenhum Property do STAYO APP/Core é criado por esse fluxo.

Após limpeza, o banco retornou ao baseline observado antes da fixture:

- `admin_condominiums = 1`;
- `implementation_projects = 4`;
- `implementation_property_details = 2`;
- `owner_records = 7`;
- fixtures da Fase 1 = 0.

## Código e CI

Validação direcionada da Fase 1:

- TypeScript typecheck: PASS;
- ESLint dos arquivos alterados: PASS;
- `bun test src/lib/opportunity-state.test.ts`: PASS;
- build: PASS.

O CI global também passou no typecheck, mas continua parando no lint global legado do repositório; por isso seus passos posteriores são pulados. Essa falha global já existia fora do escopo da Fase 1 e não substitui a validação direcionada acima.

## Validação visual pós-merge

O Lovable sincronizou a `main` no merge commit da PR e a rota autenticada `/implantacao` foi inspecionada em modo de validação, sem criação de oportunidade real.

### 375 px

- botão **Nova oportunidade** visível;
- sem overflow horizontal;
- drawer ocupa a tela inteira;
- formulário contém somente busca opcional de contato existente, nome, telefone e título provisório;
- não há condomínio, unidade ou endereço;
- botão **Criar oportunidade** inicia desabilitado com formulário vazio;
- listagem usa linhas empilhadas com título, código, contato, telefone, etapa, responsável e próxima ação.

### 390 px

- mesmos resultados do viewport de 375 px;
- sem overflow horizontal no drawer ou na listagem.

### Desktop 1280 px

- botão **Nova oportunidade** visível;
- drawer lateral com aproximadamente 28rem;
- sem overflow horizontal;
- listagem apresenta Oportunidade, Contato, Etapa, Responsável e Próxima ação;
- formulário permanece enxuto e não solicita dados do imóvel.

O estado de loading da mutation não foi disparado durante essa inspeção visual porque isso criaria um registro real; loading/disabled e prevenção de duplo submit permanecem cobertos pela implementação e pelos testes funcionais do backend.

## Reconciliação do Lovable

Durante a validação visual em plan/read-only mode, o Lovable criou inesperadamente um commit automático na `main` atualizando apenas `src/integrations/supabase/types.ts` com as assinaturas das duas RPCs recém-materializadas. Nenhum componente, rota ou regra de negócio foi modificado por esse commit.

A alteração foi auditada contra o merge da PR: foram adicionados somente os tipos de `admin_create_opportunity` e `admin_find_owner_phone_duplicates`, coerentes com o schema real. Este documento e todo o restante da entrega final voltam a ser registrados pelo fluxo canônico do GitHub. Não foi feito reset, force push ou reescrita de histórico.

## Pendências fora da Fase 1

- reunião estruturada permanece para a Fase 2;
- `portal_content_blocks` continua sendo gate obrigatório antes de qualquer publicação externa da Fase 2;
- a reconciliação global entre `drizzle/migrations` e `supabase/migrations` continua pendente e não foi improvisada nesta fase.

## Rollback

Qualquer rollback deve ser incremental:

- UI: remover/desabilitar a entrada **Nova oportunidade** por novo commit;
- banco: nova migration reversa para remover/restringir RPCs, sem editar migrations já aplicadas;
- nunca apagar oportunidades comerciais reais como forma de rollback.
