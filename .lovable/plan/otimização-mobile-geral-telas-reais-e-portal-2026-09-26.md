# Otimização mobile geral — telas reais e Portal

## Objetivo
Preparar as telas reais do STAYO Admin e as jornadas do proprietário para uso confiável no celular, preservando regras, dados, permissões, textos essenciais e identidade visual.

## Escopo
- STAYO Admin real: estrutura global, navegação, dashboard, listagens, detalhes, formulários e fluxos de Implantação, Proprietários, Imóveis, Operação, Financeiro e Configurações.
- Portal do Proprietário: login, início, troca de imóvel, módulos por fase, proposta, apresentação, cadastro, implantação, guias e estados de erro/vazio/carregamento.
- Fora do escopo: protótipos demonstrativos de Operação, Financeiro e Vistorias, exceto melhorias globais que também os beneficiem.
- Nenhuma alteração de banco, regra de negócio, permissão, integração ou conteúdo oficial.

## Implementação
1. **Base mobile compartilhada**
   - Ajustar cabeçalhos, navegação lateral, busca, abas, painéis, diálogos e áreas fixas para uso por toque.
   - Garantir largura flexível, quebra de texto segura, foco visível e áreas de toque adequadas.
   - Preservar as logos oficiais com `StayoLogo`.

2. **Listagens e informações densas**
   - Converter tabelas que hoje exigem largura fixa em cartões ou linhas responsivas no celular.
   - Manter tabelas no desktop quando forem a melhor forma de comparação.
   - Eliminar rolagem horizontal da página sem ocultar informações ou ações.

3. **Formulários e ações**
   - Reorganizar campos lado a lado para uma coluna ou combinações seguras no celular.
   - Melhorar teclado, preenchimento, seletores, mensagens de erro, botões e barras de ação.
   - Garantir que salvar, avançar, publicar, revisar e excluir permaneçam claros e acessíveis.

4. **Ficha de Implantação**
   - Revisar cabeçalho, navegação entre áreas, próxima ação, proposta, imóvel, implantação, proprietário, portal e histórico.
   - Otimizar Guias de Utensílios e Enxoval, itens faltantes, fornecedores e painéis laterais sem alterar seus fluxos.

5. **Portal e jornadas públicas**
   - Ajustar navegação com os 7–9 módulos possíveis, troca de imóvel, cards, progresso e estados.
   - Corrigir barras inferiores para áreas seguras do aparelho e manter ações visíveis com teclado aberto.
   - Revisar proposta, apresentação, cadastro, implantação e guias com textos longos e diferentes estados de acesso.

6. **Acessibilidade e estabilidade**
   - Verificar ordem de foco, fechamento de painéis, leitura de erros, contraste existente e movimento reduzido.
   - Preservar estados de carregamento, vazio, erro, sessão expirada e conta sem vínculo sem telas indefinidas.

## Validação
- Testar visualmente em 360, 375, 390 e 430 px; fazer regressão em tablet e desktop.
- Percorrer fluxos reais autenticados do Admin e, quando houver dados liberados, do Portal.
- Validar nomes, endereços e categorias longos; teclado aberto; toque; rotação; áreas seguras do iPhone.
- Confirmar ausência de corte, sobreposição, texto ilegível e rolagem horizontal.
- Executar testes existentes, verificação de tipos e compilação; corrigir apenas problemas relacionados ou bloqueadores.

## Entrega
- Resumo das telas revisadas e correções aplicadas.
- Matriz por largura e fluxo com resultado da validação.
- Lista objetiva de qualquer fluxo que não pôde ser validado por falta de dado, sessão ou liberação.
