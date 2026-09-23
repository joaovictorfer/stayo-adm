# Jornada do Proprietário — proposta, cadastro, imóvel e acesso

A entrada do proprietário na STAYO é uma **jornada única**, iniciada pelo
convite de onboarding gerado pelo time interno. O mesmo acesso conduz quatro
macroetapas:

1. **Proposta** — leitura e aceite da versão comercial vinculada ao convite;
2. **Seus dados** — identificação, contato, endereço e dados de repasse;
3. **Seu imóvel** — dados iniciais que alimentam a implantação administrativa;
4. **Seu acesso** — criação da conta do Portal do Proprietário.

A rota pública principal é `src/routes/portal.implantacao.$token.tsx`; a UI da
jornada vive em `src/components/portal/OwnerJourney.tsx`.

O Portal do Proprietário autenticado continua sendo outra experiência, após a
conclusão desta jornada. Ver `docs/OWNER_PORTAL.md`.

## Convite e segurança

`adminApi.ownerOnboarding`, em `src/lib/api/admin-client.ts`, administra os
convites e os envios. O token do convite nunca é persistido em texto puro:
somente o hash SHA-256 (`token_hash`) fica no banco. O valor bruto só é
mostrado ao time no momento da criação e enviado ao proprietário na URL.

Regras preservadas:

- expiração padrão em 7 dias;
- gerar novo convite revoga o anterior ainda ativo da mesma implantação;
- revogação manual disponível ao time interno;
- status derivado por timestamps (`expiresAt`, `revokedAt`, `usedAt`), sem
  campo de status duplicado;
- rota pública resolve o convite por RPC `security definer`, sem expor a
  tabela nem o hash ao navegador.

## Proposta obrigatória antes do cadastro

A migration `supabase/migrations/0016_owner_journey_proposal.sql` adiciona
`proposal_id` a `owner_portal_invitations`.

Na criação do convite, um trigger vincula a **versão mais recente existente
naquele instante**. A partir daí o convite fica congelado naquela versão:
criar uma v2 depois não faz um link enviado para a v1 passar a mostrar a v2.
Também é possível persistir explicitamente `proposal_id`; o trigger rejeita
uma proposta de outra implantação.

As RPCs públicas da jornada são:

- `owner_journey_resolve_proposal(token)` — devolve somente a versão exata da
  proposta, termos comerciais e resumo contratual necessário à apresentação;
- `owner_journey_accept_proposal(token, accepted_name)` — registra o primeiro
  aceite de forma idempotente e atômica.

O aceite comercial mantém os efeitos do fluxo anterior: grava o evento
`proposal.accepted` em auditoria e, quando houver termos `fixed_once`, cria a
cobrança inicial de forma idempotente por `proposal_id`.

Sem proposta vinculada a jornada **não inventa condições nem libera as etapas
seguintes**. A UI informa que a proposta ainda está em preparação.

## Etapa 2 — dados do proprietário

Reaproveita o contrato existente de `OwnerOnboardingSubmissionInput` e suas
validações. Inclui:

- PF/PJ, nome/razão social e CPF/CNPJ;
- coproprietários/proponentes adicionais;
- e-mail e telefone;
- endereço residencial;
- banco, agência, conta, titular e chave Pix.

O autosave continua ativo. A nova UI grava códigos de progresso de macroetapa
(`20` para proprietário, `30` para imóvel e `40` para acesso) para não
confundir rascunhos antigos, que usavam etapas `1..5`.

## Etapa 3 — dados iniciais do imóvel

O imóvel saiu de dentro da antiga etapa de endereço e ganhou uma macroetapa
própria. O formulário recebe, quando disponível, os dados já conhecidos pela
implantação e permite confirmar/completar:

- CEP, endereço, número/unidade, bairro, cidade e UF;
- tipo do imóvel;
- dormitórios, suítes, banheiros e vagas;
- forma e orientações de acesso;
- rede e senha de Wi-Fi;
- código de fechadura, quando aplicável.

**Regra de produto e segurança:** informações enviadas pelo proprietário
alimentam a implantação administrativa. Elas não são automaticamente
publicadas no Guia do Hóspede. Senhas, códigos e demais dados sensíveis
continuam sujeitos a revisão, minimização e acesso restrito.

## Etapa 4 — criação do acesso

Após o envio do cadastro, a última macroetapa usa
`createOwnerAccountAndLink()` (`src/lib/auth/owner-session.ts`) para criar ou
reutilizar a conta Supabase Auth e vinculá-la ao proprietário comprovado pelo
mesmo convite.

Não existe criação de conta solta: `owner_account_link` valida token, e-mail,
submissão e proprietário antes de criar o vínculo em
`owner_portal_accounts`. Quando a configuração exige confirmação de e-mail, a
jornada mostra esse estado antes do primeiro login.

## Persistência pública do onboarding

`owner_onboarding_submissions` mantém um envio por implantação. O caminho
público é protegido pelas RPCs introduzidas a partir da migration `0007`; o
visitante anônimo não recebe acesso direto às tabelas protegidas por RLS.

O envio final continua atômico: valida o convite e os dados no servidor,
grava o cadastro e marca o convite como usado. O link usado pode continuar a
ser resolvido para exibir o estado final e concluir o vínculo da conta, mas
não aceita um segundo envio do formulário.

## Compatibilidade

A rota antiga de proposta (`/portal/proposta/$token`) permanece como caminho
legado de visualização/aceite por token próprio. A jornada oficial para novos
proprietários é o convite único `/portal/implantacao/$token`.

Convites antigos sem uma proposta persistida podem permanecer com
`proposal_id = null`; nesses casos a primeira etapa fica bloqueada até uma
nova jornada ser preparada, em vez de apresentar dados não versionados.

## Implantação da migration

A migration `0016_owner_journey_proposal.sql` deve ser aplicada de forma
controlada somente depois da revisão do schema remoto e dos testes de banco.
O arquivo versionado no GitHub é a fonte canônica da mudança estrutural; a UI
não deve executar DDL nem usar Lovable para aplicar schema.
