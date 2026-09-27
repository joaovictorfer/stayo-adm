# Fase 4 — Proposta guiada até publicação e link

## Objetivo
Tornar a jornada guiada suficiente para preparar, validar, publicar e compartilhar a proposta, sem obrigar a passagem pelo editor antigo. Preservar o editor como opção avançada e manter versionamento, snapshot imutável, aceite, histórico e separação dos tokens.

## Estado confirmado
- A jornada já persiste as condições comerciais e contratuais em `implementation_contract_conditions`.
- O rascunho publicável também exige ao menos um item de serviço. Hoje esses itens, o objeto da parceria, as responsabilidades e os signatários são mantidos pelo editor avançado.
- Os quatro serviços sugeridos e seus valores já existem em `PROPOSAL_ITEM_TEMPLATES`; a jornada ainda não os utiliza.
- Não há textos oficiais cadastrados para objeto, responsabilidades ou signatários. Esses campos são opcionais no contrato atual e continuarão preservados quando já existirem, sem conteúdo inventado.
- A publicação atual cria versão, congela um snapshot com whitelist, substitui a versão publicada anterior e protege versões publicadas/aceitas contra alteração.
- O link de apresentação tem token próprio, expiração e revogação; ele é separado do link de cadastro e não envia WhatsApp automaticamente.
- Branch atual: `edit/edt-431d2e30-aac8-49d0-9539-8a937ca739a7`; HEAD `a5e55bb`.

## Alterações

### 1. Serviços dentro de “Proposta · 2 de 3”
- Adicionar “Serviços desta proposta” abaixo da preparação do imóvel.
- Carregar o rascunho existente e mostrar os serviços já selecionados, sem sobrescrever personalizações.
- Permitir selecionar os quatro modelos existentes: Implantação, Limpeza pós-obra, Acompanhamento de fornecedores e Lavagem de enxoval.
- Permitir “Outro serviço” com descrição e valor explícitos; nenhum preço será criado automaticamente.
- Salvar no rascunho versionado existente, incluindo opções e cópias dos modelos, sem tabela nova.
- Ao avançar, voltar ou sair, aguardar o salvamento para preservar a retomada do rascunho.

### 2. Revisão guiada precisa
- Resumir administração, limpeza comercial, vigência, aviso prévio e quantidade de serviços.
- Exibir “Falta adicionar ao menos um serviço.” quando necessário, com **Resolver** levando diretamente a “Proposta · 2 de 3”.
- Exibir outros erros de validação no item correspondente, sem redirecionar ao editor genérico.
- Manter **Editar proposta avançada** como ação secundária para objeto, responsabilidades, signatários e casos complexos.

### 3. Publicação direta pela revisão
- O botão **Publicar proposta e gerar link** salvará o rascunho mais recente, validará a revisão esperada e executará a publicação existente.
- Após publicar, gerará um link de apresentação para a versão publicada, com a validade padrão já usada pelo sistema.
- A sequência será idempotente e tratará conflitos de revisão sem alterar versões publicadas ou aceitas.
- Nenhuma mensagem externa será enviada automaticamente.

### 4. Sucesso pós-publicação
Mostrar no próprio fluxo:
- “Proposta publicada ✓”;
- número da versão;
- link do proprietário;
- **Copiar link**;
- **Abrir como proprietário**;
- **Voltar para implantação**.

O link será apresentado no momento da geração, respeitando o contrato atual de não armazenar o token em texto aberto.

### 5. Editor avançado
- Renomear e enquadrar o editor atual como **Editar proposta avançada**.
- Ele continuará disponível na ficha e pela ação explícita da revisão.
- Não será mais passagem obrigatória do fluxo comum.
- Dados avançados e rascunhos já existentes serão preservados.

## Detalhes técnicos
- Criar helpers puros para montar itens/opções, mesclar rascunhos existentes, resumir a revisão e apontar o bloco que precisa de correção.
- Reutilizar `commercialProposalsApi.saveDraft`, `commercialProposalsApi.publish` e `presentationInvitesApi.issue`.
- Manter `commandId`, `expectedRevision`, locks, snapshots e políticas atuais.
- Não criar migration nem alterar schema/RPC/RLS nesta fase.
- Não alterar Portal, aceite comercial, cadastro do proprietário, inventário, fornecedores, guias, Core ou envio de WhatsApp.

## Validação
- Testes unitários: rascunho sem serviço, seleção por modelo, outro serviço, preservação de opções personalizadas, retorno/avanço, retomada e resumo da revisão.
- Fluxos: publicação válida, conflito de revisão, nova versão, versão já publicada, snapshot, geração/expiração do link e ausência de envio automático.
- Regressão: editor avançado, apresentação pública e Portal.
- Verificar tipos, lint, testes relevantes e estado final do preview.
- Validar visualmente em 375, 390, 430 e 1440 px, sem rolagem horizontal, com capturas de 390 px antes/depois.

## Entrega e parada
Relatar causa da duplicidade, arquitetura anterior/nova, arquivos alterados, ausência de migration, testes, capturas, riscos, commit, PR e estado GitHub. Não fazer merge e não iniciar a Fase 5.
