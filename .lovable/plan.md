# Plano visual — Guias de Implantação STAYO

## Objetivo
Criar uma concepção navegável, exclusivamente demonstrativa, para os Guias de Utensílios e Enxoval no Admin e no Portal do Proprietário. A entrega servirá como referência visual e de interação para implementação posterior pelo Executor no GitHub.

## Limites desta fase
- Não alterar produção, banco, migrations, SQL, permissões, dados reais ou integrações.
- Não publicar.
- Não corrigir nem substituir os fluxos produtivos atuais.
- Não simular sucesso operacional como se fosse uma ação real.
- Usar dados fictícios claramente identificados e rotas isoladas de protótipo.
- Como o PDF não está disponível nos anexos, usar integralmente o conteúdo textual já existente no projeto sobre o Guia de Utensílios, conforme escolha aprovada.

## Diagnóstico visual considerado
- A implantação atual apresenta Guia de utensílios, Guia de enxoval, Enxoval de compras e Inventário como entradas próximas, com vocabulário que pode sugerir sobreposição.
- O Admin atual privilegia listas compactas e detalhe sob demanda; o Portal já usa cartões visuais, chips e controles de quantidade.
- A resposta do proprietário e a validação oficial da STAYO existem como momentos diferentes, mas essa separação ainda precisa ficar mais evidente na experiência visual.
- O protótipo preservará navy, superfícies claras, verde de apoio, tipografia e logos oficiais STAYO, priorizando arquitetura e reconhecimento visual do produto.

## Arquitetura proposta

### 1. Mapa conceitual inequívoco
Representar os quatro conceitos como etapas conectadas, sem misturá-los na mesma superfície:

```text
Guia STAYO
  recomendação reutilizável
        ↓ aplicar
Guia deste imóvel
  cópia e personalização
        ↓ liberar
Resposta do proprietário
  declaração aguardando análise
        ↓ confirmar explicitamente
Inventário oficial
  dado validado pela STAYO
```

Cada contexto terá rótulo, linguagem e status próprios. Nenhuma resposta do proprietário parecerá automaticamente confirmada.

### 2. Admin — visão do Guia aplicado ao imóvel
- Cabeçalho compacto com imóvel, tipo de guia, progresso e controle de visibilidade.
- Categorias em chips horizontais.
- Busca e filtros por estado, sem painel de métricas volumoso.
- Itens em lista visual compacta: imagem, nome, quantidade, classificação e um único status principal.
- Toque/clique abre detalhe sob demanda; edição e revisão ficam fora da visão principal.
- Placeholder oficial STAYO consistente para qualquer item sem foto.

### 3. Admin — detalhe e revisão
- Detalhe em painel inferior no mobile e painel lateral/modal contido no desktop.
- Imagem como primeiro elemento, seguida por especificação, dica STAYO e indicação de compra.
- Blocos visualmente separados: “Recomendação STAYO”, “Resposta do proprietário” e “Validação STAYO”.
- Estados: não informado, aguardando análise, confirmado, corrigido, rejeitado e quantidade inferior ao recomendado.
- Confirmação apresentada como ação deliberada que poderá alimentar o inventário apenas na futura implementação real.

### 4. Portal — resposta rápida do proprietário
- Uma coluna em 390 px, com foto ampla e texto mínimo.
- Uma decisão por vez: “Já tenho”, “Vou comprar/Já comprei” ou “Ainda não”.
- Quantidade por stepper grande somente quando necessária.
- Dica, especificação e compra reveladas sob demanda.
- Avanço claro entre itens e resumo da categoria, evitando botão “Salvar” repetido em todos os cartões.
- Mensagem explícita e breve: “Sua resposta será revisada pela STAYO”.

### 5. Relação com Inventário e Itens faltantes
- O Guia não será apresentado como inventário.
- O Admin terá uma passagem visual clara da resposta pendente para a validação.
- Após uma confirmação demonstrativa, o protótipo mostrará apenas uma prévia do impacto: recomendado, declarado, confirmado e diferença.
- “Faltando” será consequência visual da quantidade validada, nunca da declaração ainda pendente.

## Telas e estados do preview

### Mobile principal — 390 px
1. Entrada dos Guias na Etapa 4 da Implantação.
2. Lista do Guia de Utensílios aplicado ao imóvel.
3. Detalhe de item com placeholder STAYO.
4. Fila de respostas aguardando validação.
5. Guia no Portal do Proprietário.
6. Resposta rápida e quantidade.
7. Resumo antes de enviar.
8. Confirmação de envio para revisão.

### Desktop pertinente — 1440 px
1. Guia aplicado ao imóvel com lista e detalhe lado a lado.
2. Fila de revisão com contexto suficiente para decisão rápida.
3. Comparação visual entre resposta e inventário oficial, sem aparência de planilha.

### Variações obrigatórias
- Com foto e sem foto.
- Não informado.
- Já tenho.
- Já comprei.
- Aguardando validação.
- Confirmado integralmente.
- Confirmado parcialmente / faltando.
- Corrigido pela STAYO.
- Item opcional.
- Categoria vazia.
- Carregamento e indisponibilidade demonstrativos.

## Direção visual
- Imagens de produto dominam o reconhecimento; texto apenas para decisão e contexto.
- Cards apenas para itens ou decisões reais, sem cards aninhados.
- Chips para categorias e filtros; botões grandes para ações; ícones com rótulos acessíveis.
- Navegação progressiva, poucas ações por tela e CTA alcançável no mobile com safe area.
- Placeholder autoral STAYO: composição navy/verde, marca oficial discreta e ícone de categoria; sempre com aspecto intencional, nunca de imagem quebrada.
- Mesma hierarquia em 375, 390 e 430 px; desktop aproveita largura sem virar tabela administrativa.

## Validação visual
- Conferir o fluxo completo em 375, 390, 430 e 1440 px.
- Verificar cortes, sobreposições, rolagem horizontal, áreas de toque, contraste, legibilidade e safe area.
- Validar que cada tela comunica claramente qual dos quatro conceitos está sendo exibido.
- Validar que nenhum estado sugere alteração real de produção.
- Fazer ao menos uma rodada de refinamento após inspeção das capturas.

## Entrega
- Preview navegável isolado e somente demonstrativo.
- Capturas dos estados principais em 390 px e 1440 px.
- Resumo curto das decisões arquiteturais relevantes.
- Registro explícito das limitações: conteúdo baseado no material textual existente, sem o PDF original e sem qualquer implementação operacional.
