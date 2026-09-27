# Fase 2 — Unificar Inventário e Itens faltantes

## Estado confirmado
- Branch `edit/edt-68b327b0-96f4-4a95-8a55-a4371bca742a`, HEAD `84752e2`, alinhado com `origin/main` e sem alterações locais no pre-flight.
- A ficha e o cadastro guiado hoje apresentam “Itens do imóvel” e “Itens faltantes” como áreas separadas, embora ambas leiam e escrevam em `implementation_supply_items`.
- Faltas de itens de inventário já são calculadas por `required_qty - existing_qty`; pendências manuais usam `module = faltante`. A tela atual de faltantes agrupa registros com mesmo nome e ambiente para esconder duplicidades.
- O banco contém atualmente uma pendência manual e nenhuma duplicidade por nome/ambiente. A tabela existente já possui quantidades, estado, prioridade, responsável e bloqueio; não é necessária nova tabela nem migração dos dados.
- A prontidão principal da ficha usa o checklist separado (`implementation_items`). O marcador `blocks_readiness` do inventário será preservado, sem conectar ou alterar o checklist nesta fase.
- “Enxoval” da Etapa 4 é a planilha de compras existente (`SupplySheet`) e continuará independente. Guia de Utensílios e Guia de Enxoval não serão alterados.
- As duas fontes mestras citadas não estão disponíveis nos arquivos enviados nem no histórico acessível. A execução seguirá esta especificação e as regras já registradas no projeto, sem inventar conteúdo dessas fontes.

## Implementação
1. **Um único domínio de Inventário**
   - Consolidar a lógica de `EnxovalTab` e `MissingItemsTab` em um painel único de Inventário.
   - Ler todas as linhas existentes de `implementation_supply_items` sem copiar ou migrar registros.
   - Manter `module = enxoval` e `module = faltante` somente como distinção interna entre item derivado do inventário e pendência manual.
   - Centralizar em funções testáveis o cálculo de quantidade faltante, completo/resolvido, bloqueador e origem.

2. **Lista e filtros únicos**
   - Exibir nome, ambiente, “Necessário X · possui Y” e “Completo” ou “Falta X”.
   - Oferecer filtros `Todos`, `Faltando`, `Resolvidos` e `Bloqueadores`, com contagens coerentes.
   - Não incluir “Em compra” nesta fase: o domínio possui estados e etapas de compra diferentes entre si, e transformá-los em um filtro único sem regra adicional seria ambíguo.
   - Preservar prioridade, responsável, especificação, observações, dispensa, reabertura e justificativa obrigatória ao retirar bloqueio.

3. **Regras de resolução sem duplicação**
   - Item derivado fica faltante quando `existing_qty < required_qty` e completo quando a quantidade existente atende à necessária.
   - Resolver um item derivado atualizará a quantidade existente de modo coerente, em vez de criar uma segunda linha ou mascarar uma diferença de quantidade apenas pelo estado.
   - Pendência manual continuará resolvida/dispensada/reaberta por status, pois não representa contagem de um item de inventário preexistente.
   - Prevenir nova pendência manual duplicada para o mesmo nome e ambiente; registros históricos existentes continuam visíveis e editáveis.
   - Preservar os eventos de auditoria e atualizar apenas seus rótulos visíveis para “Inventário”, sem alterar o contrato persistido.
   - Fechar o atalho atual que permite apagar um bloqueador sem justificativa pela tela de inventário; ações sensíveis seguirão a mesma confirmação e auditoria da área unificada.

4. **Cadastro e ficha**
   - Na Etapa 4, substituir “Itens do imóvel” e “Itens faltantes” por uma entrada `Inventário`.
   - Manter a ordem solicitada: `Enxoval`, `Inventário`, `Fornecedores`, `Observações`.
   - Na ficha, substituir as duas linhas concorrentes por uma única linha `Inventário`; manter guias, Enxoval de compras e fornecedores intactos.
   - Preservar o redirecionamento de rascunhos antigos que tenham `etapa=itens` ou `etapa=faltantes` para a Etapa 4.

5. **Experiência mobile-first**
   - Usar cartões compactos como visual principal, inclusive em 390 px, sem tabela horizontal obrigatória.
   - Abrir `+ Adicionar item` em modal compacto; remover os formulários permanentes de inclusão das experiências antigas.
   - Manter controles com áreas de toque adequadas, edição acessível e rodapé da jornada utilizável com teclado aberto.
   - No desktop, usar uma lista mais densa; não introduzir uma segunda experiência concorrente em tabela nesta fase.

## Detalhes técnicos
- Criar um módulo puro para tipos, normalização por nome/ambiente, derivação de estado e filtragem do inventário.
- Criar um componente único de Inventário e trocar os consumidores em `OpportunityJourney` e na ficha de implantação.
- Remover os componentes antigos apenas depois que nenhum consumidor permanecer; `SupplySheet` continua como Enxoval/compras.
- Corrigir invalidações de consulta para que alterações de quantidade, estado e bloqueio apareçam imediatamente em todas as superfícies relacionadas.
- Não alterar schema, RLS, Portal, Core, proposta, publicação, fornecedores ou os dois Guias.

## Validação
- Testes unitários: completo, parcial, faltante, bloqueador, manual, mudança de `existing_qty`, mudança de `required_qty`, prevenção/agregação de duplicidade e todos os filtros.
- Regressão: dispensa/reabertura e justificativa de bloqueador; prontidão principal permanece baseada no checklist atual.
- Fluxo real: dados existentes continuam visíveis; adicionar, editar, resolver e retomar sem duplicação; voltar/avançar na Etapa 4 preserva dados.
- Visual: capturas antes/depois em 390 px e validação em 375, 390, 430 e desktop, sem rolagem horizontal.
- Executar lint dos arquivos alterados, typecheck, testes relevantes e suíte existente; confirmar build da prévia.

## Entrega e parada
- Relatar comportamento anterior e novo, arquivos, ausência de migration, capturas, testes e regressões.
- Registrar branch, HEAD/commits, status de PR e sincronização com GitHub conforme os recursos disponíveis.
- Não fazer merge e não iniciar a Fase 3.
