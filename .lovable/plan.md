# Ajuste da prontidão operacional

## Objetivo
Corrigir a prontidão para que uma implantação sem requisitos configurados nunca apareça como apta, mantendo progresso e prontidão independentes.

## Implementação
- Centralizar em `implementation-status` o resultado tipado da prontidão: `nao_avaliada`, `com_pendencias`, `bloqueada` e `apta`, com rótulo e indicador `ready` derivados da mesma regra.
- Considerar a prontidão avaliada somente quando existir ao menos um requisito de prontidão (`mandatory` ou `blocker`) no checklist.
- Aplicar precedência: bloqueador crítico aberto → `Bloqueada`; obrigatório aberto → `Com pendências`; requisitos avaliados e resolvidos → `Apta`; nenhum requisito → `Não avaliada`.
- Preservar o comportamento de itens concluídos, não aplicáveis e itens pulados com override formal.
- Atualizar o cabeçalho, os indicadores do workspace, a listagem/funil e os filtros para consumirem o estado centralizado, sem cálculos paralelos.
- Atualizar o PDF de resumo para receber e imprimir o estado completo de prontidão, incluindo “Não avaliada”.
- Atualizar a documentação da regra e ampliar testes unitários para os quatro estados e suas precedências.

## Validação
- Rodar a suíte de testes e o build do projeto.
- Confirmar especificamente que checklist vazio e checklist sem requisitos resultam em “Não avaliada”, nunca “Apta”.
