# STAYO ADMIN — Fase 2C — Validação final

## Resultado

Fase 2C implementada sobre o domínio existente `proposals`, sem criar domínio paralelo, aceite comercial, contrato, cobrança ou apresentação pública nova.

## Git e ambiente

- Repositório: `joaovictorfer/stayo-adm`
- Branch: `phase2c-versioned-proposals`
- Base inicial da fase: `f1f69a1dc82fd52bbf53ad4edb862d1f63d428f8`
- Lovable Cloud: `Stayo Adm`
- Project ID: `696b2125-0bf9-4538-8458-05d88fc5e8a2`
- Banco proibido nesta fase: `jsxwyewasvcxkgbpbdvk` — não utilizado

## Auditoria inicial

O domínio `proposals` já existia, mas o fluxo legado:

- criava versões sem separar claramente draft/publicação;
- ainda podia depender de localStorage em partes do fluxo;
- gerava PDF combinando proposta salva com condições comerciais vivas;
- permitia leitura de proposals por proprietário através de policy anterior;
- mantinha RPCs públicas legadas por token.

A Fase 2C evoluiu a implementação existente em vez de criar outro domínio.

## Migration

Arquivo aplicado exatamente como versionado:

`supabase/migrations/0022_versioned_commercial_proposals.sql`

Preflight no banco correto confirmou:

- `proposals` com 0 registros;
- ausência das novas colunas da 2C;
- ausência das três novas RPCs administrativas.

Após aplicação foram confirmados:

- coluna de status, revisão, snapshot, publicação e auditoria;
- RLS ativa;
- policy de SELECT restrita a `authenticated` com papel administrativo/comercial;
- `anon` sem privilégios;
- authenticated com apenas SELECT direto e escrita somente por RPCs autorizadas;
- RPCs `admin_list_proposal_versions`, `admin_save_proposal_draft` e `admin_publish_proposal` disponíveis apenas aos papéis previstos;
- trigger de proteção de versão publicada/aceita.

## Comportamento funcional comprovado no Lovable Cloud real

Foi usada uma fixture sintética sem PII sobre oportunidade de teste com baseline `0 proposals`.

Comprovado:

1. criação de draft v1;
2. edição do mesmo draft com incremento de `draftRevision`;
3. persistência entre chamadas independentes;
4. publicação de v1 com snapshot completo;
5. replay da publicação com o mesmo `commandId` mantendo uma única versão;
6. tentativa de alterar versão publicada bloqueada pelo trigger de imutabilidade;
7. criação de nova negociação como v2;
8. publicação de v2 sem alterar o snapshot da v1;
9. v1 marcada como `accepted` apenas como fixture técnica para comprovar que nova publicação não altera versão aceita;
10. hash do snapshot da v1 permaneceu idêntico antes e depois da v2;
11. chamada de owner-only sem papel administrativo rejeitada;
12. `anon` sem acesso administrativo;
13. resolver público legado por token não retorna draft, mesmo com share link sintético apontando diretamente para o draft.

## PDF

O Admin da 2C usa `generatePublishedProposalPdf` somente com `CommercialProposalSnapshot` publicado. O gerador legado foi preservado apenas para compatibilidade da rota pública existente; a Fase 2C não cria nem amplia apresentação pública.

## UI

`ProposalTab` passou a oferecer:

- draft interno editável;
- prévia interna;
- publicação explícita;
- histórico de versões com número e status;
- geração de PDF somente para versão publicada;
- estados de loading, erro/desconectado, retry e ausência de versões;
- bloqueio de edição de versões publicadas.

A tela 2C não usa `proposalsStore`/localStorage para persistência oficial e não cria link público ou comunicação externa.

## Qualidade

Run final de validação antes da remoção do workflow temporário:

`36148953908` — `SUCCESS`

Passaram:

- TypeScript;
- lint direcionado;
- Vitest;
- build;
- instalação de Chromium;
- Playwright responsivo da aba Proposta em 375 px, 390 px e desktop 1280 px;
- verificação de ausência de overflow horizontal;
- screenshots armazenados como artifact `phase2c-responsive-evidence`.

## Limpeza

Todas as fixtures sintéticas da Fase 2C foram removidas. A chamada autenticada final de `admin_list_proposal_versions` para a oportunidade de teste retornou `[]`.

O workflow e o smoke responsivo temporários foram removidos da branch após a validação, preservando os runs como evidência.

## Fora do escopo preservado

Não foram implementados nesta fase:

- aceite comercial;
- contrato de gestão;
- cobrança;
- nova apresentação pública;
- disparo de WhatsApp/e-mail;
- Fase 2D.