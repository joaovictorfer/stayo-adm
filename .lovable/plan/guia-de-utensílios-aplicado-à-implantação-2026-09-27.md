# Guia de Utensílios aplicado à implantação

## Objetivo

Expandir somente o protótipo visual isolado para mostrar como o Guia STAYO é aplicado e personalizado em `Vêneto · A-Verona · 105`, preservando o catálogo mestre e sem banco, API, persistência ou alteração do fluxo real.

## Experiência proposta

1. **Entrada na Implantação**
   - Linha compacta `Utensílios`, com `32 recomendações`, estado `Nenhuma resposta ainda` e seta de acesso.
   - A entrada abre o guia específico daquele imóvel, sem expor inventário ou detalhes técnicos.

2. **Estado sem guia**
   - Título `Guia de utensílios`, mensagem curta e duas ações: `Aplicar guia padrão STAYO` e `Começar vazio`.
   - Aplicar cria somente uma cópia local demonstrativa; começar vazio abre a escolha para um item exclusivo.

3. **Guia aplicado**
   - Cabeçalho com `Guia de utensílios`, identificação `Vêneto · A-Verona · 105` e controle exclusivo `Portal do proprietário: Privado / Visível`.
   - Chips `Todos`, `Cozinha`, `Quartos` e `Banheiros`.
   - Cards visuais compactos com foto/placeholder, nome, quantidade recomendada, resposta do proprietário e acesso ao detalhe.
   - Exemplos de estado: `Ainda não informado` e `Proprietário: já possui`.

4. **Edição da cópia do imóvel**
   - Bottom sheet em 390 px e drawer em desktop.
   - Mesmo formulário visual aprovado: foto, nome, categoria, quantidade, classificação, especificação, dica e link.
   - Acrescentar apenas a ação contextual `Ocultar deste imóvel`.
   - Texto curto deixa explícito que a alteração vale somente para esta implantação e não muda o Guia STAYO.

5. **Adicionar item**
   - Primeiro mostra duas escolhas: `Do catálogo STAYO` e `Item exclusivo deste imóvel`.
   - `Do catálogo STAYO` abre uma seleção visual compacta de itens ainda não aplicados.
   - `Item exclusivo deste imóvel` abre o formulário aprovado, marcado como exclusivo e sem opção de alterar o catálogo mestre.

## Estados e limites

- O protótipo permitirá alternar entre entrada, sem guia e guia aplicado para visualizar todos os estados pedidos.
- O controle Privado/Visível afetará somente a apresentação local do Guia de Utensílios.
- Busca, filtros, aplicação, visibilidade, edição, ocultação e adição funcionarão apenas em memória durante a demonstração.
- Não incluir Portal, documentos, proposta, enxoval, inventário detalhado, faltas técnicas, estoque, compra, checkout, financeiro ou fornecedores.

## Validação visual

- Validar entrada, estado vazio, guia aplicado, edição e item exclusivo em 390 e 1440 px.
- Confirmar cards legíveis, ações acessíveis, drawer/bottom sheet corretos e ausência de rolagem horizontal.
- Confirmar que a rota demonstrativa não chama APIs nem altera dados reais.