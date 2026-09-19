# Redesign incremental do Stayo Admin

## Direção aprovada

- **Visual:** Modern alpine admin, reinterpretado como central operacional premium — não como template genérico.
- **Paleta fixa:** navy-petróleo `#102F46`, apoio `#17576A`, champagne `#B99655`, fundo `#F5F7F7`, superfícies brancas.
- **Tipografia fixa:** Sora em títulos e Manrope na interface.
- **Estrutura fixa:** bento funcional, com prioridade para situação, atenção, responsável e próxima ação.
- **Marca:** usar a logo oficial enviada, sem redesenhar ou alterar. A versão clara será usada sobre a sidebar navy.
- **Escopo:** apresentação e experiência. Rotas, APIs, autenticação, dados, regras, permissões e fluxos existentes permanecem intactos.

## Auditoria da interface atual

### Diagnóstico

A base é funcional e consistente, mas visualmente homogênea. O shell atual organiza as rotas, porém apresenta todos os módulos no mesmo nível, usa a marca apenas como letra “S” e ainda carrega a linguagem verde/editorial do Guide. Dashboard, listas e detalhes são tecnicamente corretos, mas têm aparência de scaffold: grandes áreas vazias, pouca priorização operacional e repetição de cards de campos.

### Classificação

| Elemento | Classificação | Direção |
|---|---|---|
| TanStack Router, Query e árvore de rotas | **MANTER** | Preservar integralmente navegação, carregamento e cache. |
| Clientes `AdminApiClient` / `CoreApiClient` | **MANTER** | Nenhuma leitura ou escrita será desviada. |
| Regras de implantação, prontidão, progresso e versionamento | **MANTER** | Apenas nova apresentação visual. |
| Estados loading, vazio e erro | **EVOLUIR** | Manter comportamento e tornar cada estado mais claro e contextual. |
| Sidebar e drawer mobile | **REFATORAR** | Agrupar rotas reais por contexto, usar navy e logo oficial, preservar todos os destinos. |
| Topbar | **REFATORAR** | Breadcrumb mais claro, busca contextual, notificações e perfil sem simular funções inexistentes. |
| Tokens em `theme.css` e `styles.css` | **SUBSTITUIR** | Consolidar tokens semânticos navy, tipografia, sombras, raios, foco e estados. |
| `PageHeader`, `Panel`, campos e filtros | **REFATORAR** | Criar base reutilizável mais densa, responsiva e coerente. |
| `IndicatorCard`, `Timeline`, `Drawer`, `Wizard` | **EVOLUIR** | Preservar contratos e modernizar aparência, foco e movimento. |
| Dashboard atual | **SUBSTITUIR** | Passar de contadores cadastrais para situação operacional baseada apenas nos dados disponíveis. |
| Lista e workspace de Implantação | **REFATORAR** | Imóvel como identidade principal, código técnico secundário, próxima ação e hierarquia clara. |
| Lista e workspace de Imóvel | **REFATORAR** | Cabeçalho contextual, seções operacionais e IDs técnicos discretos. |
| Demais módulos | **EVOLUIR DEPOIS** | Herdar o Design System somente após validação das três telas piloto. |

### Inventário funcional preservado

- **Shell:** desktop com sidebar, mobile com drawer, breadcrumb, conta e saída.
- **Rotas administrativas:** Dashboard; Imóveis; Condomínios; Reservas; Hóspedes; Implantação, Propostas e Templates; Vistorias; Operação; Prestadores; Mensagens; Proprietários; Contratos; Guia; Produtos; Financeiro; BI; Configurações e suas subseções.
- **Implantação:** criação, filtros, funil, status, progresso, prontidão, proprietários, imóvel, enxoval, faltantes, checklist, proposta, documentos e portal.
- **Imóvel:** detalhe e linha do tempo agregada.
- **Bibliotecas visuais:** Tailwind v4, Lucide, Radix/shadcn primitives, Sonner, Recharts.

## Etapa 1 — Design System e App Shell

- Importar a logo oficial clara via Lovable Assets e aplicá-la na sidebar.
- Criar tokens semânticos para superfícies, navy, champagne, estados, bordas, foco, sombras, raios e tipografia.
- Carregar Sora e Manrope no documento.
- Reorganizar a navegação real em grupos: Visão geral, Portfólio, Implantação, Operação, Gestão, Ecossistema e Sistema, sem remover rotas.
- Criar sidebar navy responsiva com item ativo, grupos, rodapé de usuário e base preparada para futuro recolhimento.
- Refinar topbar e largura da área de trabalho.
- Evoluir componentes compartilhados: botões, cards, inputs, selects, filtros, tabs, badges, tabelas, estados vazios, skeletons, alertas, progresso e timeline.
- Validar desktop, notebook e celular antes de avançar.

## Etapa 2 — Dashboard piloto

- Cabeçalho contextual com saudação e data.
- Bento operacional derivado somente das consultas existentes: movimentações de reservas, pendências, implantações, vistorias, contratos e saúde disponível.
- Diferenciar claramente “sem dados/conexão” de zero real; não inventar eventos.
- Organizar indicadores do dia, atenção necessária, operação, implantações e integrações com estados vazios próprios.
- Garantir que cards acionáveis usem rotas existentes.

## Etapa 3 — Implantação piloto

- Refinar lista e funil sem alterar filtros ou criação.
- No detalhe, usar condomínio/unidade ou apelido como título e deixar `IMP-*` como código técnico secundário.
- Criar cabeçalho bento com status, progresso, prontidão e pendências sempre separados.
- Refinar stepper, próxima ação recomendada derivada de pendências reais e navegação por abas.
- Preservar todos os painéis e ações atuais, inclusive PDFs, portal, proposta e histórico.
- Manter IDs e campos técnicos fora da hierarquia principal.

## Etapa 4 — Imóvel piloto

- Refinar lista e vazio operacional.
- Criar workspace com nome do imóvel, condomínio/unidade, status e ações existentes.
- Organizar os campos disponíveis em visão geral e resumo operacional; não inventar campos que os tipos atuais não possuem.
- Manter linha do tempo e vínculos reais.
- Ocultar IDs técnicos da leitura principal, mantendo-os apenas em seção técnica discreta quando necessários.

## Validação de cada etapa

1. Conferir visual no preview em 1280×1800 e 390×1800.
2. Testar navegação, drawer, busca/filtros, abas, formulários e ações afetadas.
3. Verificar ausência de sobreposição, corte e rolagem horizontal indevida.
4. Conferir contraste, foco de teclado, áreas clicáveis e movimento reduzido.
5. Rodar verificação de tipos e testes seletivos relevantes.
6. Comparar com as capturas anteriores e só então seguir para a próxima etapa.

## Fora desta entrega inicial

- Propagação para todos os módulos antes da validação das três telas piloto.
- Alterações em banco, migrações, APIs, integrações, autenticação, regras de negócio ou permissões.
- Dados demonstrativos apresentados como dados reais.
- Implementação de busca global ou notificações sem fonte funcional existente.
