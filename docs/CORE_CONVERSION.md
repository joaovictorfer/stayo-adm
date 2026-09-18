# Conversão para o Stayo Core (Fase 11)

Cobre a transição, no futuro, de uma implantação para Property/Owner
**oficiais** do Core — o momento em que o imóvel deixa de ser só um
pré-imóvel do Admin e passa a existir de verdade no sistema operacional
(STAYO.APP).

## Regra de ouro

**Nunca inventar `corePropertyId`/`coreOwnerId`.** Enquanto o Core não
expuser um endpoint de escrita real, não existe conversão possível — só o
contrato que a conversão real vai usar.

## `CoreConversionService` (`src/lib/core-conversion.ts`)

- `searchOwner`/`searchProperty` — **já funcionam de verdade**, contra
  `coreApi.owners.search()`/`coreApi.properties.list({ q })` (Grupo B,
  hoje sempre mock vazio por contrato, mas a chamada é real — quando o
  Core existir, a busca funciona sem mudar nenhuma linha aqui). Search
  sempre roda antes de criar, para nunca duplicar um Owner/Property que já
  existe no Core.
- `createOwner`/`createProperty`/`linkImplementation` — **stubs
  explícitos**: lançam `CoreConversionNotAvailableError` sempre, porque
  não existe endpoint de escrita do Core para chamar. Não é um "TODO"
  silencioso — é uma decisão de segurança: nenhum destes três nunca deve
  fabricar um ID que o Core não reconheceria.
- `convertImplementation` — orquestra tudo. **Idempotente**: se a
  implantação já tem `corePropertyId`/`coreOwnerId`, retorna o resultado
  existente sem nenhuma chamada nova. Caso contrário, sempre lança (feature
  flag ligada ou não — ver abaixo), porque não há como converter sem
  endpoint de escrita.

## Feature flag

`VITE_ENABLE_CORE_CONVERSION` (`.env.example`) — desligada por padrão.
Existe para permitir ligar a preparação de UI/telemetria (auditoria via
`core_conversion.requested`) antes do endpoint real existir, sem oferecer
falsa esperança de que a conversão realmente acontece — mesmo ligada, o
resultado é o mesmo erro explícito.

## UI

Painel "Conversão para o Core" em `implantacao.$id.tsx`
(`CoreConversionPanel`) — mostra se já foi convertida (com os dois IDs) ou,
caso não, por que ainda não é possível, com um botão que sempre tenta e
sempre mostra o erro real (nunca finge sucesso).

## Quando o Core real existir

1. Implementar `createOwner`/`createProperty`/`linkImplementation` de
   verdade contra o endpoint de escrita (nunca antes disso).
2. `convertImplementation` passa a: buscar (nunca pular esta etapa) → criar
   só se não encontrar → `linkImplementation` grava
   `corePropertyId`/`coreOwnerId` de volta na implantação via
   `coreApi.implementations.update()`.
3. A UI não muda — o painel já lê `corePropertyId`/`coreOwnerId` como
   fonte da verdade.
