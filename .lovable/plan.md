# STAYO APP no Admin — Fase 1 de paridade visual e funcional

## Objetivo

Reproduzir no STAYO Admin a arquitetura, a aparência e os fluxos da primeira fase documentada do STAYO APP. Esta etapa cobre Dashboard, Reservas, Agenda operacional, Imóveis, Condomínios, Proprietários e Cadastros enviados. As demais telas do relatório ficam registradas para fases seguintes; áreas sensíveis poderão existir visualmente, mas sem ação real antes das APIs controladas.

## Princípios

- O STAYO APP/Core continua como fonte oficial; o Admin não cria uma segunda fonte de reservas, imóveis, hóspedes, proprietários ou condomínios.
- Reutilizar os contratos e adaptadores já existentes, mantendo os dados demonstrativos atuais onde a API ainda não existe.
- A interface deve ter a mesma organização do relatório: sidebar por áreas, topo com breadcrumb, busca e notificações, petróleo/off-white/dourado, títulos serifados, cartões claros, chips e estados consistentes.
- Preservar a marca com `StayoLogo` e os arquivos oficiais.
- Nenhum dado sensível de acesso, CPF, banco, Wi-Fi, token ou hóspede será ampliado nesta fase.
- Toda tela será validada em 390 px e desktop; no celular, tabelas viram cartões e filtros permanecem acessíveis.

## 1. Base visual compartilhada

- Ajustar o shell atual para a hierarquia visual do APP: grupos de navegação, item ativo, área do usuário, breadcrumb, busca e notificações.
- Consolidar padrões reutilizáveis para cabeçalho de módulo, indicadores, abas, chips, busca, cartões com imagem, estados vazios, carregamento e indisponibilidade.
- Aplicar o mesmo vocabulário visual nas sete áreas, evitando que protótipos e páginas reais continuem parecendo produtos diferentes.
- Preservar permissões existentes; esconder um item de menu nunca será tratado como autorização.

## 2. Dashboard

- Reproduzir a saudação e o painel do dia do relatório, com chegadas, saídas, check-ins, alertas e prioridades.
- Manter os dados já agregados pelo Dashboard atual, reorganizando-os na composição visual do STAYO APP.
- Incluir estados de carregamento, período vazio e integração indisponível sem apresentar zero como dado confirmado.
- Manter atalhos apenas para rotas reais e seguras do Admin.

## 3. Reservas — leitura

- Substituir a lista linear atual pela carteira visual do relatório: indicadores, abas de período/situação, chips secundários, busca e cartões de reserva.
- Exibir somente os campos seguros já previstos no contrato: código, imóvel, canal, datas, status e web check-in.
- Detalhe continua em leitura; ações que criam reserva, liberam acesso, copiam guia ou disparam automação não serão conectadas nesta fase.
- Estados de carregamento, vazio, parcial e indisponível serão explícitos.

## 4. Agenda operacional — leitura

- Promover a experiência visual já prototipada para uma rota real de Agenda dentro de Operação.
- Reproduzir dia, semana e por imóvel, filtros e detalhe lateral/inferior conforme o APP.
- Alimentar a tela pelo contrato de tarefas e eventos disponível; sem atribuir, reagendar ou concluir enquanto não houver comando idempotente do Core.
- No mobile, usar uma agenda legível em cartões/linha do tempo, sem depender de uma grade desktop comprimida.

## 5. Imóveis

- Reproduzir os indicadores, busca, filtros e alternância grade/lista do relatório.
- Cartões terão foto quando autorizada, fallback institucional, código, condomínio, status e progresso permitido pelo contrato.
- A ficha existente permanece como destino do cartão; dados de acesso continuam excluídos.
- Criação e edição operacional ficam sem ação real até a API de comando correspondente.

## 6. Condomínios

- Converter a listagem atual em cartões equivalentes ao APP, com imagem/fallback, nome, cidade e quantidade de imóveis.
- Preservar o cadastro mestre atual do Admin, mas separar visualmente dados já persistidos de campos que futuramente virão do Core.
- O botão de novo condomínio permanece somente onde a permissão e o fluxo atual já são válidos; a futura troca pelo comando Core será feita sem alterar a experiência.

## 7. Proprietários e Cadastros enviados

- Reproduzir o cabeçalho `Gestão de Proprietários`, os indicadores, as abas e a busca do relatório.
- Manter Proprietários e Cadastros enviados como vistas distintas e navegáveis, compartilhando a mesma base visual.
- A lista de proprietários usa o relacionamento comercial atual; a tela deixa claro o estágio antes do vínculo oficial com o Core.
- Cadastros enviados mostrará situação, imóvel vinculado, data e ações já permitidas pelo fluxo atual; revisão e liberação ao Portal continuam decisões separadas.
- Não expor dados bancários, CPF completo ou token público na listagem.

## 8. Navegação e transição

- Criar rotas reais para qualquer página da Fase 1 ainda representada apenas por protótipo ou aba interna, e adicioná-las à navegação no mesmo conjunto de alterações.
- Remover a dependência de URLs órfãs para Agenda e Cadastros enviados, sem apagar protótipos de outras fases.
- Manter URLs públicas existentes e não alterar o Portal do Proprietário nesta etapa.

## 9. Validação

- Conferir cada tela lado a lado com as páginas correspondentes do relatório.
- Validar navegação completa entre as sete áreas, busca, filtros, abas, grade/lista, detalhes e retornos.
- Testar carregando, vazio, com dados, parcial, erro e integração indisponível quando aplicável.
- Validar 390 px e desktop, sem rolagem horizontal incoerente, textos cortados ou controles inacessíveis.
- Confirmar que nenhuma ação visual nova grava, dispara mensagens, cria reserva ou executa automação sem API autorizada.

## Continuidade após a Fase 1

As demais telas do relatório serão reproduzidas em fases posteriores, usando a mesma base visual: Hóspedes; Mensagens e IA; Guia e Serviços; Central Operacional, Tarefas, Vistorias e Manutenção; Implantação, Inventário, Estoque e Fornecedores; Financeiro; Configurações, Equipe, Alertas, Automações e integrações; Portal Staff. Antes de ativar qualquer ação sensível, cada fluxo receberá contrato Core, permissão, auditoria e idempotência.
