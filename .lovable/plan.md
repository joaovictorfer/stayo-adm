# Guia de Utensílios — revisão Admin

## Objetivo

Desenhar, no protótipo visual isolado, a revisão das respostas do proprietário com leitura imediata de quantidade informada, compra prevista, ausência de resposta e diferença para o recomendado. Não alterar o fluxo Admin real, banco, APIs ou inventário.

## Arquitetura da proposta

### 1. Topo compacto

- Título `Guia de utensílios`.
- Resumo em uma linha ou grade curta conforme a largura:
  - `32 itens`
  - `18 confirmados`
  - `4 para revisar`
  - `10 não informados`
- Filtros em chips: `Todos`, `Para revisar`, `Faltando`, `Vai comprar`, `Concluídos`.
- Sem busca, categorias ou ações de catálogo nesta proposta, para manter o foco na revisão.

### 2. Lista visual

- Cards compactos, sem tabela, com foto pequena, nome e recomendação.
- A resposta do proprietário aparece como informação separada da confirmação STAYO.
- O card inteiro abre a revisão; `Confirmar` fica visível apenas quando há resposta a revisar.
- Exemplos demonstrados:
  - `Taças de vinho`: recomendadas 6, proprietário informou 4, `Faltam 2`, aguardando revisão.
  - `Cafeteira`: recomendada 1, `Compra prevista pelo proprietário`.
  - Item confirmado integralmente.
  - Item confirmado abaixo do recomendado.
  - Item não informado.

### 3. Revisão individual

- Bottom sheet no mobile e drawer lateral no desktop.
- Conteúdo curto: foto, nome, recomendado, informado e `Quantidade confirmada`.
- Seletor grande `− 4 +` e ação principal `Confirmar informação`.
- `Corrigir` como ação secundária dentro da mesma interação; não abrir formulário extenso.
- Após confirmar, fechar a revisão e atualizar o card localmente para `✓ Confirmado pela STAYO`.

### 4. Falta derivada do próprio item

- Quando a quantidade confirmada for menor que a recomendada, o mesmo card mostra `Faltam N`.
- Não criar uma segunda ficha, lista duplicada ou pendência manual para representar essa falta.
- O filtro `Faltando` seleciona esses mesmos cards confirmados abaixo do recomendado.

### 5. Compra prevista

- Resposta `Vou comprar` aparece como `Compra prevista pelo proprietário` com ícone de compra.
- O estado permanece distinto de `Confirmado pela STAYO` e não aparenta disponibilidade física.
- O filtro `Vai comprar` reúne esses mesmos itens, sem marcá-los como concluídos.

## Mobile 390 px

- Uma coluna, imagem pequena e conteúdo hierarquizado em poucas linhas.
- Métricas compactas sem aparência de dashboard.
- Chips com rolagem horizontal controlada.
- Resultado (`Faltam 2`, `Confirmado`, `Compra prevista`) visível sem abrir detalhes.
- Bottom sheet com ações grandes e rodapé respeitando a área segura.

## Desktop

- Mesma arquitetura, com largura maior e lista em duas colunas quando houver espaço.
- Revisão abre em drawer lateral, preservando o contexto da lista.
- Nenhuma tabela, confirmação em lote ou painel adicional.

## Estados entregues

1. Lista completa.
2. Cinco filtros funcionais no protótipo.
3. Revisão individual.
4. Item confirmado.
5. Item faltando.
6. Item com compra prevista.
7. Desktop em 1440 px.
8. Mobile em 390 px.

## Limites e validação

- Usar somente dados fictícios e estado local na rota isolada do protótipo.
- Não chamar APIs, persistir respostas, alterar o Admin real ou atualizar inventário.
- Validar filtros, confirmação, correção de quantidade e estados em 390 e 1440 px.
- Confirmar textos sem corte, ausência de rolagem horizontal, fotos/placeholder consistentes e nenhum erro de console.