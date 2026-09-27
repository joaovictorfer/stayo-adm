# Guia de Utensílios — Admin

## Objetivo

Refocar o protótipo isolado em uma biblioteca administrativa visual de utensílios, sem banco, API, persistência, publicação ou alteração das telas operacionais existentes.

## Entrega visual

1. **Catálogo mobile — 390 px**
   - Cabeçalho somente com título, subtexto de uma linha e `+ Adicionar item`.
   - Busca “Buscar utensílio...” e chips `Todos`, `Cozinha`, `Quartos` e `Banheiros`.
   - Lista de cards compactos, em uma coluna, mostrando apenas foto/placeholder, nome, quantidade, classificação e acesso ao detalhe.

2. **Catálogo desktop — 1440 px**
   - Mesma hierarquia do mobile, sem acrescentar painéis administrativos.
   - Grade visual compacta que aproveita a largura sem transformar o catálogo em tabela.
   - Detalhe aberto em drawer lateral, preservando o contexto da biblioteca.

3. **Detalhe do item**
   - Bottom sheet no mobile e drawer no desktop.
   - Foto grande, quantidade recomendada, especificação, dica STAYO e indicação de compra.
   - Ações demonstrativas `Editar` e menu de mais opções.

4. **Edição do item**
   - Tela focada e curta dentro do mesmo sheet/drawer.
   - Foto com ação de enviar/trocar, nome, categoria, quantidade, classificação, especificação, dica e link de indicação.
   - Botões de cancelar e salvar apenas alteram o estado local da demonstração.

5. **Placeholder STAYO**
   - Fundo neutro, ícone simples de utensílio e assinatura visual oficial STAYO discreta.
   - Sem fotografia falsa e consistente nos cards, detalhe e edição.

## Conteúdo do PDF

- Usar exclusivamente itens, quantidades e especificações encontrados nas 8 páginas do PDF enviado.
- Demonstrar exemplos suficientes entre Cozinha, Quartos e Banheiros, incluindo itens com e sem foto.
- Itens marcados como opcionais no PDF serão `Opcional`; os demais serão `Recomendado` por padrão, conforme definido.
- A dica de reposição seguirá a observação do PDF; indicações sem URL real serão apresentadas como demonstração indisponível, sem inventar destino.

## Interações demonstrativas

- Busca e chips filtram somente os dados locais.
- Tocar em um card abre o detalhe; `Editar` alterna para o formulário.
- `Adicionar item`, upload, menu e salvamento não terão efeito real nem integração.
- A proposta terminará nessas cinco vistas; Portal, revisão do proprietário, inventário, estoque, compras, checkout, financeiro e fornecedores ficam fora deste recorte.

## Validação

- Conferir visualmente catálogo, detalhe, edição e placeholder em 390 e 1440 px.
- Confirmar legibilidade, áreas de toque, ausência de rolagem horizontal e funcionamento das interações locais.
- Confirmar que nenhuma chamada de escrita ou leitura operacional foi introduzida.