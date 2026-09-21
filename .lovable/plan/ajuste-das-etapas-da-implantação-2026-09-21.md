# Ajuste das etapas da implantação

## Objetivo
Refazer somente a apresentação do status da implantação, preservando o ciclo e a alteração de estado existentes.

## Implementação
- Substituir a faixa horizontal com largura mínima e rolagem por uma grade de nove etapas que cabe integralmente no desktop.
- Usar marcadores e conectores semanticamente distintos para etapas concluídas, atual, futuras e bloqueadas.
- Exibir todos os rótulos sem truncamento, com quebra controlada em duas linhas quando necessário.
- No mobile, transformar a mesma sequência em timeline vertical, eliminando qualquer vazamento lateral.
- Manter o seletor de status e os estados alternativos existentes.

## Validação
- Conferir que a primeira e a última etapa ficam integralmente visíveis.
- Validar ausência de rolagem horizontal no componente em desktop e mobile.
- Rodar o build de produção e parar.
