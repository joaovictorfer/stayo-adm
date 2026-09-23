# Rebuild visual do Stayo Admin

## Objetivo
Reconstruir a apresentação do Admin como ferramenta operacional premium, com sidebar navy e área principal clara, sem alterar banco, regras, integrações, permissões, Portal do Proprietário ou comportamento funcional.

## Implementação

### 1. Base visual light-first
- Remover a influência automática de `prefers-color-scheme: dark` sobre o Admin.
- Criar tokens semânticos exclusivos do Admin para fundo, superfícies, sidebar, textos, bordas, ações, acento, estados, sombras, raios e espaçamento.
- Mapear os tokens Stayo existentes e os controles compartilhados para a mesma base clara, mantendo o tema do Portal isolado e inalterado.
- Padronizar foco, hover, pressed, loading e redução de movimento.

### 2. Estrutura do Admin
- Reconstruir a sidebar em navy profundo, com logo oficial, identificação “Centro de Controle”, grupos visuais solicitados e destaque claro da rota atual.
- Preservar todas as rotas, filhos e regras de papel existentes; o agrupamento será apenas de apresentação.
- Adicionar rodapé de usuário com iniciais, nome, papel e saída.
- Refinar a topbar clara, reduzindo o peso de busca/notificação enquanto forem apenas auxiliares e mantendo contexto da página.
- Preservar drawer mobile e impedir overflow horizontal.

### 3. Biblioteca visual reutilizável
- Criar uma pequena camada de componentes Admin para cabeçalhos, seções, estatísticas, alertas, status, barras de ferramentas/filtros, listas/linhas, estados vazios, cabeçalhos de workspace e ações.
- Evoluir `ListStates` e `IndicatorCard` para consumir essa camada sem quebrar seus consumidores atuais.
- Substituir estilos inline repetidos primeiro nos componentes compartilhados, Dashboard e páginas-piloto; evitar uma refatoração ampla e arriscada de formulários complexos.
- Usar Outfit/IBM Plex Sans em títulos, KPIs, tabelas e controles do Admin.

### 4. Dashboard orientado a ação
- Criar saudação dinâmica, data e atalhos para Nova implantação e Operação.
- Montar “Hoje” apenas com eventos que podem ser derivados dos dados atuais; quando indisponíveis, exibir estado vazio honesto em vez de números inventados.
- Priorizar “Atenção necessária” com tarefas pendentes/atrasadas, vistorias, contratos próximos do vencimento e implantações que aguardam ação.
- Criar “Operação do dia” com horário, imóvel e tarefa existentes.
- Mostrar somente implantações relevantes com etapa, progresso disponível e próxima ação segura.
- Rebaixar indicadores de portfólio a métricas secundárias e remover todo texto técnico sobre mock/API/Core.

### 5. Listagens
- Aplicar o padrão consistente inicialmente em Imóveis, Implantações, Proprietários, Reservas e Operação usando os componentes compartilhados.
- Organizar cabeçalho, busca, filtros, toolbar, badges, linhas interativas, skeletons, erros e vazios úteis.
- Manter filtros, criação, navegação e consultas atuais sem mudanças funcionais.

### 6. Validação
- Validar rotas principais e estados de loading/vazio/erro sem modificar dados.
- Testar desktop e mobile, incluindo sistema operacional em modo escuro, sidebar/drawer, topbar e ausência de overflow.
- Executar lint, testes e build disponíveis; corrigir apenas regressões relacionadas ao rebuild visual.

## Limites
- Nenhuma migration, mudança no backend, Core/Admin clients, cálculos, propostas, contratos, prontidão, RLS, permissões ou Portal do Proprietário.
- Nenhuma métrica, evento ou valor fictício será apresentado como dado real.
