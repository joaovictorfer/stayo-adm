# Propostas — versionamento, persistência e aceite

## Versionamento real

Cada salvamento de proposta cria uma **nova versão**. Uma versão anterior
nunca é sobrescrita e a versão aceita permanece imutável. `Proposal.version`
é sequencial por implantação; editar depois de uma v1 aceita significa criar
v2, não alterar v1.

A tabela real `proposals` foi introduzida em
`supabase/migrations/0010_proposals.sql`, com `unique
(implementation_id, version)` e os itens gravados como snapshot JSONB da
versão.

`proposalsStore` (`src/lib/api/local-store.ts`) agora usa Supabase quando o
projeto está configurado. O localStorage permanece somente como fallback de
desenvolvimento e como origem de uma promoção idempotente de versões antigas:
registros históricos do navegador são copiados para `proposals` quando não
existem no banco, sem apagar a origem local e sem sobrescrever uma versão já
persistida.

## Jornada oficial do proprietário

A experiência oficial de entrada usa o convite único de onboarding:

`/portal/implantacao/$token`

A migration `0016_owner_journey_proposal.sql` adiciona `proposal_id` ao
convite. Na criação, o convite congela a versão exata que será apresentada ao
proprietário. Assim, um convite preparado com v1 continua exibindo v1 mesmo se
uma v2 for criada depois.

A primeira macroetapa é obrigatória:

**Proposta → Seus dados → Seu imóvel → Seu acesso**

O proprietário só avança depois do aceite comercial. A UI lê a proposta e os
termos por `owner_journey_resolve_proposal(token)` e aceita por
`owner_journey_accept_proposal(token, accepted_name)`.

## Link público legado de proposta

`ProposalShareLink` e `/portal/proposta/$token` permanecem por compatibilidade
com links já enviados e para visualização isolada de uma proposta.

Esse caminho também é versionado por `proposalId`, nunca por
`implementationId`, portanto um link da v1 não deve passar a mostrar uma v2.
A jornada nova, porém, não depende mais de um segundo token de proposta: para
novos proprietários, a versão é associada ao próprio convite de onboarding.

## Aceite

O aceite exige nome completo e confirmação explícita de concordância. Ele é
um **registro auditável de aceite comercial**, não uma assinatura jurídica do
contrato.

No novo fluxo, o aceite é idempotente e executado no servidor. Somente a
primeira confirmação:

- grava `accepted_at` e `accepted_name` na versão exata;
- registra `proposal.accepted` em `audit_logs`;
- cria a cobrança inicial quando houver termos `fixed_once`, protegida por
  unicidade de `proposal_id`.

Cliques repetidos ou duas abas simultâneas não reescrevem o primeiro aceite
nem duplicam a cobrança.

## Termos comerciais

`commercial_terms` é a fonte dos termos cadastrados para a implantação, como:

- taxa de administração (`percentage`);
- taxa de implantação (`fixed_once`);
- taxa por reserva ou limpeza (`per_reservation`), quando modelada dessa forma;
- mensalidades (`monthly`);
- opcionais e informativos.

A proposta pública apresenta esses termos como condições separadas do total do
snapshot quando não representam itens cobrados naquela versão. Condições
operacionais complementares podem ser exibidas a partir de
`implementation_contract_conditions` quando essa estrutura estiver disponível
no schema aplicado.

## PDF

`src/lib/pdf/proposal-pdf.ts` usa `pdf-lib` e continua gerando o documento a
partir do snapshot de uma versão específica. O PDF nunca deve reconsultar uma
versão mais nova para substituir silenciosamente a que foi compartilhada ou
aceita.

Dados bancários completos do proprietário não fazem parte da proposta.

## Estado de implantação

O código e a migration da jornada são versionados no GitHub. A migration
`0016_owner_journey_proposal.sql` **não deve ser aplicada diretamente pelo
frontend ou pelo Lovable**. A aplicação no banco deve ocorrer pelo processo
controlado, após revisão do schema remoto e testes específicos de banco/RLS.
