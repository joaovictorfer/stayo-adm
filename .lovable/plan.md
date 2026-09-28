# Etapa 4 de 5 · Implantação — hub de entrada (protótipo visual)

Escopo: somente concepção visual, na rota isolada de protótipos de Guias, com estado local. Sem banco, APIs, migrations, publicação ou alteração das telas reais.

## Tela (390 px como referência)

```text
Etapa 4 de 5 · Implantação
Implantação
O que você quer registrar agora?

[Garfo]    Utensílios      12 de 32 respondidos  >
[Cama]     Enxoval         Ainda não iniciado    >
[Chave]    Fornecedores    2 de 6 definidos      >
[Alerta]   Pendências      4 itens               >

+ Adicionar nota            (ação secundária, só texto)
```

- Quatro cards grandes, uma coluna, ícone + título + uma linha de status + seta.
- Sem card "Itens do imóvel" e sem cadastro de "Itens faltantes".
- Pendências é somente leitura: soma do que falta resolver em Utensílios, Enxoval e Fornecedores.
- A nota abre um bottom sheet curto (mobile) ou uma pequena janela (desktop).

## Estados (alternador de demonstração)

- Vazio: "Ainda não iniciado" nos três módulos; Pendências "Nada por enquanto" (card esmaecido, sem seta de ação).
- Parcial: textos do exemplo; barra fina de progresso em cada card.
- Concluído: selo verde "Concluído" em cada card; Pendências "Tudo resolvido"; faixa discreta "Implantação pronta para revisão" com o botão "Continuar para etapa 5".

## Desktop 1440

- Mesma lista em grade 2×2, largura máxima ~880 px, centralizada; nota como link abaixo. Nada de painéis laterais nem métricas.

## Fluxo de entrada e retorno

```text
Etapa 3 -> Hub Etapa 4 -> toca "Utensílios" -> tela do guia (já aprovada)
        <- "Voltar à Implantação" (topo) -> hub com status atualizado
Pendências -> lista curta agrupada por origem -> tocar item abre o módulo de origem
```

- Rodapé fixo com safe area: "Voltar" (Etapa 3) e "Continuar" (Etapa 5), sempre disponível; nunca bloqueia.
- Ao retornar de um módulo, o card tocado mostra "✓ Salvo" por alguns segundos.

## Detalhes técnicos

- Nova visão "Hub Etapa 4" em `src/routes/guias-implantacao-prototipo.tsx`, com estados locais vazio/parcial/concluído e navegação simulada para as telas já aprovadas.
- Tokens de design existentes do portal; ícones lucide (Utensils, BedDouble, Wrench, AlertTriangle).
- Validação Playwright em 375/390/430/1440: sem rolagem horizontal nem erros de console.
