# Guia de Utensílios — experiência do proprietário

## Objetivo

Transformar somente o protótipo visual isolado na experiência mobile do proprietário para consultar recomendações e informar `Já tenho` ou `Vou comprar`, sem banco, APIs, persistência ou alteração do portal real.

## Entrega em 390 px

1. **Entrada do módulo**
   - Bloco `Prepare seu imóvel` com a linha `Utensílios`, progresso `12 de 32 respondidos`, barra discreta e botão `Continuar`.

2. **Lista visual**
   - Cabeçalho curto `Utensílios` + `12 de 32 itens respondidos` e barra de progresso.
   - Chips `Todos`, `Cozinha`, `Quartos`, `Banheiros` e busca.
   - Uma coluna de cards com imagem predominante, nome, quantidade recomendada e as duas decisões sempre visíveis.

3. **Estados dos cards**
   - Não respondido: `Já tenho` e `Vou comprar` neutros.
   - Já possui: confirmação visual simples `✓ Já possui`, mantendo a possibilidade de trocar a resposta.
   - Vai comprar: estado `Pretende comprar` com ícone de compra e `Ver indicação` apenas quando houver referência.
   - Sem foto: reutilizar exatamente o placeholder STAYO aprovado, nunca bloco vazio ou erro técnico.

4. **Quantidade inteligente**
   - Para recomendação maior que uma unidade, `Já tenho` abre um bottom sheet curto com seletor `− quantidade +`, recomendação e `Salvar`.
   - Para recomendação de uma unidade, confirmar diretamente no card sem pergunta adicional.

5. **Detalhes sob demanda**
   - `Ver detalhes` abre bottom sheet com foto, nome, recomendação, especificação, Dica STAYO e indicação.
   - Quando houver produto indicado, mostrar `Ver produto ↗` e a observação curta de que é apenas uma referência e pode ser substituído por equivalente.

6. **Salvamento e finalização**
   - Após cada decisão, mostrar `✓ Salvo` discretamente no próprio card, sem modal.
   - O progresso será atualizado localmente durante a demonstração.
   - Ao responder todos os itens demonstrados, mostrar uma finalização leve com barra completa e ação para voltar à jornada, sem aparência de dashboard.

## Interação do protótipo

- O protótipo permitirá alternar entre a entrada e a lista, filtrar, buscar, responder, ajustar quantidade e abrir detalhes.
- Os exemplos cobrirão item sem resposta, já possui, vai comprar, com indicação e sem foto.
- As respostas usarão somente linguagem do proprietário: `Não respondido`, `Já possui` e `Vai comprar`.

## Limites

- Não exibir revisão administrativa, inventário confirmado, faltas técnicas, `pendente`, `review_status`, `aprovado` ou qualquer estado operacional.
- Não incluir formulário tradicional, tabela, painel de métricas, texto jurídico ou explicação administrativa.
- Não alterar o Guia Admin aprovado nem misturar Enxoval, documentos ou proposta.

## Validação visual

- Validar todos os dez estados solicitados em viewport de 390 px.
- Confirmar uma coluna, fotos reconhecíveis, ações grandes, bottom sheets acessíveis, textos sem corte e ausência de rolagem horizontal.
- Confirmar que a demonstração não realiza chamadas de dados nem altera o portal real.