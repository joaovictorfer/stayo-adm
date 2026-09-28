# STAYO APP no Admin — Fase 2: Hóspedes, Mensagens e IA, Guia e Serviços

## Objetivo

Levar para o Admin as próximas áreas do relatório do STAYO APP, com a mesma base visual da Fase 1: petróleo/off-white/dourado, títulos serifados, indicadores, abas, chips, busca e cartões. Tudo em modo leitura ou demonstração até existir a API de comando no Core.

## Princípios

- O STAYO APP/Core continua sendo a fonte oficial de hóspedes, mensagens, automações, guia público e serviços.
- Nenhuma mensagem é enviada, nenhuma automação é disparada, nenhuma resposta de IA é publicada e nenhum pedido de serviço é criado nesta fase.
- Dados sensíveis ficam de fora: documentos, CPF, telefone completo, e-mail completo, códigos de acesso, Wi-Fi e tokens.
- Cada tela é validada em 390 px e no computador; no celular, tabelas viram cartões.

## 1. Hóspedes

- Carteira visual: indicadores (hospedados agora, chegando, recorrentes), abas por situação, busca e cartões.
- Cartão mostra nome, imóvel, período da reserva, canal e situação do web check-in.
- Contato aparece mascarado; a ficha existente continua sendo o destino e segue somente leitura.

## 2. Mensagens e IA

- Caixa de entrada no padrão do APP: lista de conversas à esquerda, conversa à direita (no celular, uma tela de cada vez).
- Filtros: Todas, Não lidas, Precisam de atenção, Automáticas.
- Painel de sugestão da IA e lista de automações aparecem como demonstração, com campo de resposta e botões desativados e aviso "Envio disponível após integração com o Core".

## 3. Guia e Serviços

- Guia / Conteúdo: cartões por imóvel com capa (ou imagem padrão STAYO), seções do guia e situação de publicação, apenas para leitura.
- Produtos / Serviços: vitrine em cartões com foto, preço de referência e disponibilidade; sem carrinho, cobrança ou pedido real.

## 4. Navegação

- Reaproveitar as rotas atuais (Hóspedes, Mensagens, Guia, Produtos) e ajustar os grupos do menu conforme o relatório, sem mudar endereços públicos.

## 5. Validação

- Comparar cada tela com a página correspondente do relatório.
- Testar os estados com dados, vazio, carregando e integração indisponível.
- Confirmar em 390 px e no computador, sem rolagem horizontal, e que nenhum botão grava ou envia algo.

## Próximas fases

Fase 3: Central Operacional, Tarefas, Vistorias e Manutenção. Fase 4: Implantação, Inventário, Estoque e Fornecedores. Fase 5: Financeiro. Fase 6: Configurações, Equipe, Alertas, Automações, integrações e Portal Staff.

## Detalhes técnicos

- Reutilizar `PhaseOnePatterns` e as classes de `theme.css`; leituras continuam pelas queries existentes (Core mock).
- Mascaramento de contato feito na apresentação; nenhum DTO novo com PII.
- Sem migrations, sem alteração em escrita/`core-client`.
