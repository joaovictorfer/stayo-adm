# Fase 3 — Fornecedores em lista + detalhe

## Estado confirmado

- Branch atual: `edit/edt-5b457108-748d-4107-8bf0-49ff2f9e4eae`; HEAD `ffa5825`, alinhado com `origin/main` e sem alterações locais no pré-flight.
- No Admin, `PropertySuppliersPanel` carrega categorias, respostas e catálogo e reutiliza o `SupplierEditor`, que hoje abre todas as categorias com as quatro escolhas simultaneamente.
- O mesmo `SupplierEditor` também atende o Portal do Proprietário. Para não alterar o Portal, a nova navegação será aplicada somente no painel administrativo.
- O domínio existente já contempla catálogo, categorias customizadas, respostas `catalog`, `other`, `unknown` e `not_applicable`, origem proprietário/STAYO, revisão e histórico imutável.
- As quatro tabelas de fornecedores estão com segurança por linha ativa. Leitura é permitida aos papéis internos previstos; escrita administrativa permanece restrita a super admin, admin, comercial e operações. O proprietário continua limitado às RPCs validadas por token e não altera resposta revisada pela STAYO.
- O banco atual tem cinco empresas sugeridas no catálogo e não tem respostas ou categorias customizadas ativas. Não haverá seed nem alteração de dados.
- As duas fontes citadas não foram encontradas como documentos disponíveis no projeto ou nos arquivos enviados. A implementação seguirá esta especificação e as regras verificadas do repositório.

## Resultado

### 1. Lista administrativa compacta

- Substituir os cards expandidos do Admin por uma linha tocável por categoria, em uma coluna no celular.
- Cada linha mostrará:
  - nome da categoria;
  - empresa ou resumo da resposta atual;
  - estado textual: **Definido**, **Não informado**, **Não se aplica** ou **A confirmar**;
  - seta para abrir o detalhe.
- Derivar esses estados dos dados já existentes, sem criar status persistido:
  - `catalog` ou `other` com nome: Definido;
  - `unknown`: Não informado;
  - `not_applicable`: Não se aplica;
  - resposta do proprietário aguardando revisão ou empresa manual sem nome: A confirmar.
- Quando houver mais de uma empresa na categoria, resumir a primeira e indicar a quantidade adicional sem esconder os registros.
- Manter alertas gerais de respostas do proprietário e nomes pendentes, além do feedback de autosave.

### 2. Detalhe sob demanda

- Ao abrir uma categoria, trocar a lista por um detalhe com **Voltar para fornecedores**.
- Exibir inicialmente apenas as escolhas **Buscar empresa**, **Outra empresa**, **Não sei informar** e **Não se aplica**.
- Depois da escolha, revelar somente os campos pertinentes já existentes: empresa, telefone, serviço realizado, papel da empresa, data aproximada e observações; observação interna continuará exclusiva do Admin.
- Preservar múltiplas empresas por categoria, edição, remoção e bloqueio visual das respostas revisadas conforme as regras atuais.
- Catálogo, busca por especialidade, empresas sugeridas e criação de “Outra empresa” continuarão usando os dados e filtros existentes.

### 3. Categorias e contexto de navegação

- Trocar o campo de nova categoria sempre aberto por **Adicionar categoria**, abrindo um formulário compacto sob demanda.
- Manter remoção de categoria customizada apenas quando vazia.
- Preservar o gerenciador do catálogo como ação administrativa secundária, sem misturá-lo ao detalhe do imóvel.
- Na jornada guiada, a sequência será:
  - Implantação → Fornecedores;
  - categoria → Voltar para fornecedores;
  - lista → Voltar para Implantação.
- Aplicar a mesma lista/detalhe administrativa quando Fornecedores for aberto na ficha, sem mudar os demais módulos.

## Implementação técnica

- Criar helpers puros em `src/lib/property-suppliers.ts` para resumo e estado visual das categorias, cobertos por testes.
- Refatorar `PropertySuppliersPanel.tsx` para controlar lista, categoria selecionada, adição de categoria e catálogo.
- Reutilizar as partes de busca e edição existentes de `SupplierEditor.tsx`, expondo um detalhe administrativo sem alterar a experiência renderizada por `OwnerSuppliersSection`.
- Ajustar somente o rótulo de retorno da jornada em `OpportunityJourney.tsx` para manter o contexto solicitado.
- Não criar migration, tabela, campo, RPC ou novo status; não modificar Guia de Utensílios, Guia de Enxoval, proposta, publicação, Portal ou Core.

## Validação

- Testes automatizados para os quatro estados visuais, múltiplas empresas e “A confirmar”.
- Exercitar com fixtures: busca no catálogo, outra empresa, não sei, não se aplica, edição de definido, categoria customizada, autosave e preservação da origem/histórico.
- Confirmar que o painel administrativo continua respeitando leitura versus escrita por papel e que o Portal mantém o editor atual e seus bloqueios.
- Validar a jornada completa de retorno e capturar antes/depois em 390 px; revisar também 375, 430 e desktop, sem rolagem horizontal.
- Executar typecheck, lint, testes relevantes e build; não alterar dados reais apenas para produzir evidência.

## Entrega e parada

- Relatar antes/depois, arquivos alterados, capturas em 390 px, testes, riscos, branch, HEAD, commits e status de PR.
- Não fazer merge e não iniciar a Fase 4.
- Se o acesso ao GitHub continuar indisponível, registrar o PR como não confirmado em vez de inferir seu estado.
