# Auditoria somente leitura — Stayo Admin

## Escopo e evidência

Auditoria feita sem alterar o app. Foram revisadas as rotas principais no preview atual e no site publicado, em desktop e mobile:

- Dashboard
- Imóveis
- Condomínios
- Reservas
- Hóspedes
- Implantação
- Vistorias
- Operação
- Prestadores
- Mensagens
- Proprietários
- Contratos
- Guia / Conteúdo
- Produtos / Serviços
- Financeiro
- BI
- Configurações / Stayo Core

Resultado técnico da leitura:

- Todas as rotas auditadas responderam 200 no preview atual.
- Todas as mesmas rotas responderam 200 no publicado.
- O publicado está visualmente alinhado com o preview atual; a diferença visível é o badge do Lovable no publicado.
- Não apareceram erros ou avisos de console nas rotas auditadas.
- No mobile, não houve largura horizontal extra nas páginas, exceto um problema de abas em Configurações / Stayo Core.

## Diagnóstico geral

O projeto está apto como base estrutural do Stayo Admin: navegação, shell administrativo, rotas, estados de loading/erro/vazio, mock centralizado e contratos de dados estão consistentes.

A experiência ainda parece mais um protótipo técnico do que uma ferramenta operacional pronta para uso diário. O principal motivo é que quase todas as telas aparecem vazias, com componentes muito parecidos entre si, pouca hierarquia operacional e pouca diferenciação entre módulos.

O ponto mais forte hoje é a arquitetura de módulos e padrões. O ponto mais fraco é a percepção de produto: em uso real, o usuário vê muitas páginas com “0”, “nenhum registro” e cartões genéricos.

## 1) Problemas visuais e de hierarquia

### Achados gerais

- A interface é consistente, mas excessivamente homogênea: quase todos os módulos têm a mesma composição de título, filtro, card branco e mensagem vazia.
- Há muito espaço vazio em desktop, especialmente abaixo do primeiro painel de cada tela.
- A hierarquia visual favorece os containers, mas não destaca o que o usuário precisa decidir ou resolver.
- O dashboard tem presença visual melhor que as demais telas, mas comunica “mock local” e todos os indicadores estão zerados.
- A tipografia com Fraunces dá personalidade premium, mas em algumas telas técnicas ou densas pode parecer editorial demais para operação diária.
- Muitos campos e cartões usam o mesmo peso visual, então informação crítica e informação secundária competem no mesmo nível.
- O topo tem busca global e sino de notificações, mas visualmente parecem funcionais mesmo sem evidência de ação real.

### Por rota

| Rota | Leitura visual / hierarquia |
|---|---|
| Dashboard | Melhor tela em presença visual. Ainda parece uma vitrine de módulos zerados, sem prioridades operacionais reais. |
| Imóveis | Estrutura clara, mas vazia e sem contexto. Parece uma tabela aguardando dados. |
| Condomínios | Muito semelhante a Imóveis; pouca diferenciação de finalidade. |
| Reservas | Filtro de status ajuda, mas com tudo vazio parece protótipo. |
| Hóspedes | Visualmente igual às listas básicas; não transmite cuidado de privacidade além da ausência de dados sensíveis. |
| Implantação | Tem ação principal clara (“Nova implantação”), mas a tela vazia ainda não comunica fluxo operacional. |
| Vistorias | Tem estrutura, mas não diferencia o uso em campo/mobile. |
| Operação | Mais promissora: filtros de período, modo lista/agenda e cartões. No mobile, os controles ocupam bastante espaço. |
| Prestadores | Parece módulo ERP genérico com contadores e vazio. |
| Mensagens | Tem métricas, mas não parece uma central de conversas ainda. |
| Proprietários | Lista básica, sem peso visual para relacionamento/progresso com proprietário. |
| Contratos | Contadores e lista vazia; ainda sem hierarquia para vencimentos, riscos ou ações. |
| Guia / Conteúdo | Botão de criação visível, mas a tela ainda parece cadastro simples. |
| Produtos / Serviços | Botão de criação visível, mas sem linguagem visual de catálogo/oferta. |
| Financeiro | Bons cards de resumo, mas zeros e abas vazias enfraquecem. “0 · R$ 0,00” parece técnico demais. |
| BI | É claramente placeholder: grade de cards vazios aguardando Core. |
| Configurações / Stayo Core | É a tela mais técnica e coerente com o propósito, mas ainda tem eventos/logs vazios e status “Indisponível” sem explicação visual forte. |

## 2) Telas vazias ou com aparência de protótipo

Quase todos os módulos principais aparecem vazios no estado atual/publicado.

Telas que parecem protótipo por estarem vazias:

- Imóveis
- Condomínios
- Reservas
- Hóspedes
- Implantação
- Vistorias
- Operação
- Prestadores
- Mensagens
- Proprietários
- Contratos
- Guia / Conteúdo
- Produtos / Serviços
- Financeiro
- Configurações / Stayo Core, nas áreas de eventos, erros, webhooks e logs

Telas com estado “placeholder” mais explícito:

- BI: cards de métricas vazios aguardando dados.
- Dashboard: indicadores zerados e texto dizendo que os números refletem mock local.

O problema não é existir estado vazio — isso é correto para um mock. O problema é que o vazio não parece intencional nem orienta bem o próximo passo. A sensação é de sistema incompleto, não de sistema sem dados.

## 3) Responsividade e mobile

### O que está bom

- O shell muda corretamente para topo com menu no mobile.
- Os cards empilham sem quebrar a largura.
- Não há rolagem horizontal geral nas rotas auditadas.
- Dashboard, Financeiro e Operação continuam legíveis em mobile.

### Problemas encontrados

- Configurações / Stayo Core tem abas cortadas no mobile. A aba “Permissões / Scopes” aparece truncada e a sequência de abas não fica confortável.
- Em telas com muitos controles no topo, como Operação e Financeiro, os filtros e abas ocupam uma parte grande da primeira dobra no mobile.
- Os estados vazios ocupam cartões grandes, mas sem densidade informativa; em mobile isso vira uma tela longa com pouco conteúdo útil.
- A navegação mobile depende do menu lateral, mas o usuário não vê uma visão agrupada dos muitos módulos.

## 4) Componentes com cara de ERP genérico

Os padrões atuais são funcionais, mas ainda genéricos:

- Listas com linha simples e texto cinza.
- Cards de número com ícone pequeno e valor zero.
- Campos de detalhe em grid, todos com o mesmo peso.
- Estados vazios sem identidade do módulo.
- Filtros como select/input básicos.
- Abas simples sem adaptação forte para mobile.

Onde isso pesa mais:

- Imóveis, Condomínios, Hóspedes e Proprietários parecem o mesmo módulo com título trocado.
- Vistorias não parece uma ferramenta de campo ainda.
- Mensagens não parece uma central de conversas.
- Produtos / Serviços não parece catálogo de upsell.
- BI não parece área analítica, e sim grade de placeholders.

## 5) Navegação e densidade

### Pontos positivos

- Todas as rotas principais existem e carregam.
- A sidebar é previsível.
- O breadcrumb ajuda a localizar o módulo atual.
- Submenus de Implantação e Configurações funcionam visualmente.

### Problemas

- A sidebar tem muitos itens no mesmo nível, o que aumenta carga cognitiva.
- Módulos operacionais, comerciais, financeiros e técnicos aparecem misturados na mesma lista.
- A busca global no topo parece uma função importante, mas não há evidência de que navegue ou busque de verdade.
- A densidade em desktop é baixa: há poucos elementos úteis acima da dobra quando os dados estão vazios.
- A densidade em mobile é irregular: alguns módulos ficam bons, outros perdem muito espaço com filtros e abas.

## 6) O que está funcional de verdade vs mock

### Funcional de verdade na interface

- Navegação entre rotas principais.
- Layout desktop com sidebar.
- Layout mobile com menu.
- Breadcrumb por seção.
- Estados de loading, erro e vazio.
- Busca/filtro client-side nas listas, quando houver dados.
- Abas em Financeiro, Implantação e Stayo Core.
- Drawers e formulários locais em alguns módulos que já têm ações de criação.
- Publicado e preview atual estão servindo as mesmas telas principais.

### Mock / não conectado ao Core real

- Os dados de negócio vêm de `createMockCoreApiClient()`.
- As listas principais vêm vazias por contrato do mock.
- Dashboard e Financeiro calculam números sobre arrays vazios.
- Stayo Core exibe estado técnico mock: API v1 não conectada, Core mock, eventos/logs vazios.
- Templates, propostas e alguns fluxos locais usam armazenamento do navegador/local temporário, não backend real.
- Botões como busca global, notificações e algumas ações administrativas parecem UI futura, não operação real completa.

### Risco de percepção

Para quem abre o publicado sem contexto, o produto pode parecer “sem dados” ou “inacabado”, mesmo com uma arquitetura correta por trás.

## 7) Prioridades de melhoria

### Prioridade 1 — Reduzir aparência de protótipo

- Reescrever estados vazios por módulo para parecerem intencionais e operacionais.
- Diferenciar visualmente listas críticas: Reservas, Operação, Vistorias, Financeiro e Implantação.
- Evitar que todas as telas vazias tenham a mesma estrutura visual.
- Trocar mensagens genéricas por estados que expliquem claramente que o Core ainda não está conectado, quando aplicável.

### Prioridade 2 — Melhorar dashboard e primeira impressão

- Transformar o dashboard em um painel de prioridades operacionais, não só uma grade de contadores zerados.
- Separar “mock/desconectado” de “zero real”. Hoje os zeros podem ser interpretados como dados reais.
- Destacar pendências esperadas do negócio: reservas próximas, implantações em risco, vistorias pendentes, contratos vencendo e repasses.

### Prioridade 3 — Corrigir mobile em telas técnicas e com abas

- Ajustar abas de Configurações / Stayo Core para scroll horizontal ou menu segmentado responsivo.
- Melhorar a apresentação de abas em Financeiro no mobile.
- Revisar telas de Operação e Vistorias para uso em campo, com ações e informação prioritária mais acessíveis.

### Prioridade 4 — Agrupar navegação por contexto de trabalho

- Agrupar sidebar por áreas: Operação, Comercial/Implantação, Financeiro, Conteúdo, Técnica.
- Reduzir a sensação de lista longa de ERP.
- Definir se a busca global será funcional agora; se não for, reduzir sua proeminência.

### Prioridade 5 — Reforçar identidade operacional Stayo

- Criar padrões específicos para short-stay: reserva/check-in, prontidão do imóvel, vistoria, proprietário, repasse e upsell.
- Usar badges, timeline, agrupamentos e estados com significado de operação, não apenas containers genéricos.
- Preservar a paleta premium, mas aumentar contraste funcional em ações e status.

## Resumo executivo

O Stayo Admin está tecnicamente apto como base: as rotas carregam no preview e no publicado, a navegação funciona, os padrões estão consistentes e o mock está centralizado.

Ainda não está apto como experiência final de produto: a maioria das telas parece vazia, genérica ou prototipada. A próxima evolução deve focar menos em criar novas rotas e mais em dar hierarquia operacional, estados vazios melhores, diferenciação por módulo e responsividade refinada nas telas com abas e filtros.
