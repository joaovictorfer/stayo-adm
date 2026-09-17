# Condições Comerciais — defaults configuráveis + snapshot (Fase 4)

Nenhum valor (taxa de administração, limpeza, implantação etc.) fica
hardcoded em componente — tudo vem de `adminApi.commercialTermDefaults`/
`adminApi.commercialTerms` (`src/lib/api/admin-client.ts`).

## Dois níveis, nunca confundidos

- **`CommercialTermDefault`** — configurado uma vez em
  `/configuracoes/comercial`. É o catálogo (nome, tipo de cobrança, valor,
  opcional, ordem, notas).
- **`CommercialTerm`** — o **snapshot** copiado para uma implantação
  específica no momento da criação (`cloneDefaults()`, idempotente: se a
  implantação já tem termos, só os retorna, nunca duplica). Mudar um
  default depois **nunca** altera uma implantação já criada — é uma cópia,
  não uma referência.

## `ChargeType`

`percentage | fixed_once | per_reservation | monthly | optional |
informational` (`src/types/admin.ts`). Só `fixed_once` vira item de
proposta e gera cobrança inicial (ver `docs/INITIAL_CHARGES.md`); os
demais aparecem na proposta e no PDF como "condições recorrentes",
informativos, nunca somados ao total da proposta em si.

## UI

- `/configuracoes/comercial` — CRUD dos defaults.
- `implantacao.$id.tsx` (`CommercialTermsPanel`) — mostra/edita o snapshot
  desta implantação; botão "Copiar dos padrões" só aparece se ainda não
  houver nenhum termo (evita clone acidental duplicado).
- `ProposalTab` — botão "Adicionar das condições comerciais" traz os itens
  `fixed_once` do snapshot direto para o rascunho da proposta (sem
  recalcular nada — só copia label/valor).

## Persistência

`commercial_term_defaults`/`commercial_terms`
(`supabase/migrations/0003_commercial_terms.sql`) — já migradas (ver
`docs/LOCALSTORAGE_MIGRATION.md`); `createDefaultAdminApiClient()` troca
para o adapter Supabase sozinho quando configurado. `implementation_id` em
`commercial_terms` ainda não é FK de banco — só `uuid` — porque
`ImplementationProject` continua no mock do Core (ver
`docs/OWNER_IMPLEMENTATION_ARCHITECTURE.md` §5/§6).
