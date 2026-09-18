# Fluxo da Implantação — status, checklist e prontidão

Toda a lógica pura fica em `src/lib/implementation-status.ts` — nunca
duplicada dentro de um componente.

## Status (`ImplementationStatus`)

- **Fluxo principal** (`mainStatusFlow`, nesta ordem): `prospect` →
  `proposta` → `aguardando_aprovacao` → `aprovado` → `planejamento` →
  `em_implantacao` → `validacao` → `pronto_para_operacao` → `ativo`.
- **Estados alternativos** (`alternateStatuses`): `pausado`,
  `nao_convertido`, `cancelado` — saem da linha principal, não são etapas
  dela (não contam progresso no funil).
- Transição feita em `implantacao.$id.tsx` (`StatusStepper`), sempre via
  `coreApi.implementations.update()` — nunca calculada/validada só no
  cliente sem persistir.

## Checklist (`ImplementationItem`)

- Nasce de um template (`checklistTemplatesStore`,
  `generateChecklist()` — idempotente: se já existem itens, só os
  retorna, nunca duplica).
- Cada item tem `mandatory`/`blocker`/`ownerVisible` — controla o que conta
  para prontidão e o que aparece no portal do proprietário.

## Progresso × Prontidão — nunca a mesma conta

- `computeProgress()` — quantos itens estão `concluido` sobre o total que
  "conta" (`nao_aplicavel`/`pulado` saem do denominador). É só indicador de
  andamento.
- `computeReadiness()` — **operacional**: basta um item `mandatory` ou
  `blocker` em aberto para a implantação não estar apta, mesmo com 95% do
  checklist concluído. As duas contas são deliberadamente separadas — uma
  implantação pode estar "quase pronta" em progresso e ainda assim não
  operacional.
- **"Pulado" nunca resolve prontidão sozinho.** `isResolvedForReadiness()`
  só considera um item `pulado` resolvido se ele tiver um override formal
  registrado (`readinessOverrideAt` não nulo) — ver próxima seção. Sem
  isso, um bloqueador marcado como "pulado" por conveniência continua
  contando como pendência real.

## Override de prontidão

`readinessOverrideReason`/`readinessOverrideBy`/`readinessOverrideAt` em
`ImplementationItem` — um override é sempre um ato explícito e auditado
(`ReadinessOverrideRow` em `implantacao.$id.tsx`), nunca resolvido
implicitamente ao mudar o status do item. Mudar o status de volta para algo
diferente de `pulado` limpa o override (não faz sentido um override "de
pulado" sobreviver a um item que deixou de estar pulado).

## Código da implantação (`IMP-00001`)

Gerado sempre no adapter (`nextImplementationCode()` →
`nextSequentialCode("IMP", ...)`, `src/lib/sequential-code.ts`), nunca
calculado no componente a partir de uma lista já carregada — evita corrida
entre duas abas criando implantação ao mesmo tempo com o mesmo próximo
número (mitigado, não eliminado, enquanto a persistência for local; um
`unique` constraint de banco resolveria de vez quando `implementations`
migrar para uma tabela própria — ver `docs/LOCALSTORAGE_MIGRATION.md`).

## Visão de funil e filtros (Fase 12)

`implantacao.index.tsx` — alterna entre lista e uma visão de funil (uma
coluna por status do fluxo principal + alternativos). Filtros por status,
responsável (texto livre — não há diretório de usuários ainda), período
(`startDateEstimate`) e prontidão (reaproveita `computeReadiness()`, nunca
um cálculo paralelo).
