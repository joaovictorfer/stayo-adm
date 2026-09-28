# Guia de Enxoval — proposta visual integrada

## Objetivo

Desenhar o Guia de Enxoval usando exatamente o sistema visual já aprovado para o Guia de Utensílios. A proposta ficará no protótipo isolado, com estado local e conteúdo demonstrativo claramente identificado, sem alterar telas reais, banco, APIs ou inventário.

## Princípio de continuidade

- Reutilizar a mesma linguagem de catálogo visual, cards, chips, busca, detalhe progressivo, aplicação ao imóvel e checklist do proprietário.
- Mudar somente o tipo do guia, as categorias e o campo específico `Tamanho/padrão`.
- Manter separados os quatro conceitos: catálogo STAYO, cópia aplicada ao imóvel, resposta do proprietário e confirmação operacional.
- Não criar uma navegação, arquitetura ou conjunto de componentes visuais paralelo.

## 1. Admin — catálogo de enxoval

- Cabeçalho curto: `Guia de enxoval`, subtexto de uma linha e `+ Adicionar item`.
- Busca no mesmo padrão de Utensílios.
- Chips configuráveis: `Todos`, `Cama`, `Banho`, `Cozinha`, `Complementos`.
- Cards compactos com foto/placeholder STAYO, nome, quantidade recomendada, classificação e seta.
- A demonstração terá poucos itens de composição visual e um aviso persistente e discreto: `Exemplo visual — conteúdo a definir`.
- Nenhum exemplo será apresentado como catálogo oficial da STAYO.

## 2. Item e edição

- Bottom sheet no mobile e drawer no desktop, como em Utensílios.
- Exibir foto grande, nome, quantidade recomendada, `Tamanho/padrão`, descrição, Dica STAYO e indicação de compra.
- `Abrir referência` continua sendo apenas indicação, sem compra, checkout ou fornecedor obrigatório.
- Edição usa o mesmo formulário visual aprovado, acrescentando somente `Tamanho/padrão`.
- Item sem foto usa o mesmo placeholder oficial do sistema, nunca imagem falsa ou quebrada.

## 3. Aplicação ao imóvel

- Entrada compacta dentro de Implantação: `Enxoval`, contagem de recomendações, situação das respostas e seta.
- Estado sem guia: `Nenhum guia aplicado ainda`, `Aplicar guia padrão STAYO` e `Começar vazio`.
- Como não existe catálogo oficial fornecido, a ação de aplicar o padrão aparece indisponível ou em estado demonstrativo com `Conteúdo a definir`; não será simulada como catálogo real.
- Após uma cópia demonstrativa, manter os mesmos cards, edição local por imóvel, ocultação e item exclusivo aprovados para Utensílios.
- Alterações na cópia do imóvel não sugerem alteração do catálogo mestre.

## 4. Proprietário

- Entrada `Prepare seu imóvel` com progresso simples do Guia de Enxoval.
- Lista visual mobile-first com os mesmos filtros, busca e cards de Utensílios.
- Decisões principais sempre visíveis: `Já tenho` e `Vou comprar`.
- Para `Já tenho`, pedir quantidade apenas quando necessário.
- Detalhe mostra foto, recomendado, tamanho/padrão, descrição, Dica STAYO e referência.
- Resposta permanece apenas informação do proprietário, sem aparência de inventário confirmado.

## 5. Visibilidade independente

- Demonstrar lado a lado, sem mistura de permissões:
  - `Guia de utensílios · Visível`
  - `Guia de enxoval · Privado`
- Cada controle altera visualmente somente o respectivo guia no protótipo.
- Não envolver proposta, documentos ou outros blocos do portal.

## 6. Mobile 390 px

- Uma coluna, imagens reconhecíveis, pouco texto e ações grandes.
- Chips com rolagem horizontal controlada.
- Detalhes e edição em bottom sheet com área segura.
- Aplicação ao imóvel, proprietário e visibilidade legíveis sem tabela ou rolagem horizontal.

## 7. Desktop 1440 px

- Mesma hierarquia, com catálogo em grade e detalhe em drawer lateral.
- Aplicação ao imóvel preserva contexto com conteúdo principal e controle de visibilidade lateral.
- Sem converter a experiência em planilha ou painel administrativo denso.

## Estados entregues

1. Admin.
2. Item e detalhe/edição.
3. Aplicação ao imóvel, incluindo ausência de catálogo oficial.
4. Experiência do proprietário.
5. Visibilidade independente entre Utensílios e Enxoval.
6. Mobile em 390 px.
7. Desktop em 1440 px.

## Limites e validação

- Usar poucos placeholders de conteúdo, sempre marcados `Exemplo visual — conteúdo a definir`.
- Não criar ou tratar itens de enxoval como dados oficiais.
- Não chamar APIs, persistir respostas, alterar produção, banco, permissões ou inventário.
- Validar navegação entre as sete vistas, estados locais e independência visual dos dois controles.
- Confirmar textos sem corte, ausência de rolagem horizontal, placeholder consistente e nenhum erro de console em 390 e 1440 px.