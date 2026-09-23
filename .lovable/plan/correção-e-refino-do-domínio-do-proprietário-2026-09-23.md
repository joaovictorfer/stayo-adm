# Correção e refino do domínio do proprietário

## Objetivo
Corrigir a validação brasileira e consolidar o cadastro do proprietário em um fluxo seguro de cinco etapas, elevando as duas fichas administrativas ao novo padrão visual sem alterar Core, autenticação, propostas, reservas ou regras de acesso existentes.

## Implementação

### 1. Validação e normalização compartilhadas
- Corrigir o cálculo dos dois dígitos do CPF e revisar o algoritmo de CNPJ, aceitando entradas formatadas ou numéricas e rejeitando tamanho incorreto, sequências repetidas e dígitos inválidos.
- Centralizar `normalizeDocument`, `normalizePhone`, `normalizeEmail` e `normalizeName`, mantendo regras próprias para cada tipo de dado.
- Criar schemas reutilizáveis para identificação, contato, endereço e repasse; aplicar máscara e mensagens inline no portal e na edição administrativa.
- Adicionar testes unitários com CPFs/CNPJs válidos e inválidos, incluindo obrigatoriamente `094.860.164-70`.

### 2. Cadastro público em cinco etapas
- Evoluir o formulário para Identificação, Contato, Endereço, Repasse e Revisão, preservando retomada e envio pelo convite atual.
- Incluir PF/PJ, endereço completo com máscara de CEP, busca automática e preenchimento manual quando necessário.
- Estruturar banco, titular, documento do titular, tipo e chave Pix; sugerir CPF/CNPJ, telefone ou e-mail conforme o tipo escolhido, sempre permitindo substituição.
- Mostrar revisão organizada e usar o CTA “Confirmar e enviar cadastro”.
- Ajustar o Wizard para priorizar erros junto aos campos e exibir aviso geral apenas quando agregar contexto.

### 3. Persistência e validação no servidor
- Criar uma migration incremental para alinhar o envio público aos dados já existentes de perfil e conta de repasse, sem enfraquecer RLS.
- Recriar `owner_onboarding_submit` com validação server-side de nome, documento, e-mail e telefone, normalização segura, token com hash, expiração, revogação e uso único preservados.
- Manter escrita atômica do cadastro e repasse; não registrar dados sensíveis em logs.
- Atualizar os tipos e o Admin client mantendo a fachada e os consumidores atuais compatíveis.

### 4. Completude real do cadastro
- Criar uma função central de completude para Identificação, Contato, Endereço, Dados para repasse, Contrato e Documentos.
- Derivar estados `completo`, `incompleto` e `aguardando revisão` somente dos dados reais disponíveis.
- Remover os estados fixos atuais e reutilizar o cálculo na aba Proprietário da implantação e na ficha principal.

### 5. Aba Proprietário e gestão do Portal
- Reorganizar a aba Proprietário com cabeçalho compacto, badges, contato, progresso real, próxima ação e CTA contextual.
- Refinar o bloco do Portal com status, último acesso, expiração e status cadastral; manter o link secundário e recolhível.
- Preservar segredo somente quando recém-gerado; adicionar feedbacks claros para criar, copiar, enviar e revogar, com confirmação antes da revogação.
- Mascarar documento, Pix e dados bancários por padrão, com revelação explícita apenas na área administrativa já autorizada.

### 6. Nova ficha `/proprietarios/$id`
- Migrar a página para `AdminPageHeader`, `AdminSection`, `AdminStatCard`, `AdminStatusBadge`, `AdminAttentionCard`, `AdminEmptyState` e `AdminActionButton`.
- Criar cabeçalho sem IDs técnicos, indicadores compactos e abas Resumo, Imóveis, Implantações, Contratos, Financeiro, Documentos, Portal e Histórico.
- No Resumo, mostrar dados essenciais mascarados, repasse, imóveis, próxima ação e atividade recente; carregar apenas a aba visível.
- Mover UUIDs, datas técnicas e Core IDs para “Detalhes técnicos” recolhível no final.
- Adicionar edição validada, estados de carregamento, feedback de salvamento e vazios neutros quando não houver dados.

## Validação
- Executar testes unitários, incluindo validação documental, normalização e completude.
- Executar lint e build, distinguindo regressões desta rodada de problemas legados.
- Validar no navegador o cadastro público em desktop/mobile, CEP, revisão, mensagens inline, máscara e ausência de overflow.
- Validar no Admin a edição segura, aba Proprietário, Portal e ficha `/proprietarios/$id`, incluindo loading, sucesso, erro e confirmação de revogação.

## Limites
- Nenhuma mudança em reservas, financeiro global, imóveis, propostas, Core ou autenticação administrativa.
- Nenhuma flexibilização de RLS ou exposição de token, CPF/CNPJ, chave Pix ou dados bancários completos.
- Não alterar o Portal além do cadastro público e do branding diretamente ligado a ele.
