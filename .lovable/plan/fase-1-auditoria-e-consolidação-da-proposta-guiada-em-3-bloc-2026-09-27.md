# Fase 1 — auditoria e consolidação da Proposta guiada em 3 blocos

## Estado confirmado
- O HEAD atual é `9ad1380bc21b676e490edfb48af60979ed68f513`, no branch `edit/edt-a7824ef2-3a85-467d-aae5-665ced7e1fbd`, sem alterações locais; esse mesmo commit está em `origin/main`.
- O repositório local está ligado ao Git privado do projeto Lovable. O nome externo `joaovictorfer/stayo-adm` e PRs abertas não puderam ser confirmados: a CLI do GitHub não está disponível e não há conexão GitHub acessível nesta sessão.
- A implementação atual já contém os três blocos pedidos: **Condições comerciais**, **Preparação do imóvel** e **Condições do contrato**, com navegação `Proposta · 1/3`, `2/3` e `3/3`.
- O cabeçalho já está compacto, o estado de salvamento está discreto e a exclusão já fica no menu secundário com confirmação e as permissões existentes.
- Os valores usam as colunas existentes de `implementation_contract_conditions`; o schema real confirma todos os campos necessários e RLS ativa. Não há justificativa para migration.
- A Etapa 3 lê e grava a mesma linha por `implementation_id`; valores anteriores são carregados antes da edição. A etapa principal e a retomada continuam em `implementation_projects.draft_step`.
- As fontes mestras citadas não estavam entre os arquivos disponíveis. Conforme autorizado, esta auditoria seguirá a especificação desta fase e as regras já registradas no projeto.

## Execução
1. **Registrar a referência visual atual**
   - Capturar a Etapa 3 real antes de qualquer correção em 390 px, cobrindo os três blocos e o cabeçalho.
   - Usar uma oportunidade real em rascunho e não publicar proposta.

2. **Auditar os três blocos contra os critérios**
   - Confirmar que só existem três subtelas e que Voltar/Continuar percorrem `1/3 → 2/3 → 3/3` antes de avançar à Etapa 4.
   - Verificar todos os controles, campos progressivos de “Outro” e “Com limite”, estado visual das escolhas e touch targets.
   - Corrigir apenas lacunas comprovadas, mantendo o visual e os componentes já adotados.

3. **Fortalecer persistência e retomada**
   - Garantir que alterações comerciais/contratuais pendentes terminem de salvar antes de avançar, voltar ou sair.
   - Preservar os valores existentes e impedir que uma escolha rápida seja perdida ou substituída por outra gravação concorrente.
   - Garantir que “A definir” permaneça visualmente selecionado após salvar e reabrir, sem criar coluna ou valor paralelo.
   - Manter o autosave atual dos demais dados e a retomada pela macroetapa `proposta`.

4. **Cobertura automatizada focada**
   - Extrair somente a lógica necessária para testar os três blocos, mapeamento de valores e escolhas especiais sem ampliar o escopo.
   - Cobrir: 3 blocos exatos, presets, “Outro”, “A definir”, “Com limite”, resumo da proposta e preservação de campos existentes.
   - Não alterar inventário, itens faltantes, fornecedores, Portal, publicação ou ficha geral.

5. **Validação real de aceite**
   - Exercitar uma oportunidade real: editar todos os grupos, voltar/avançar, sair, reabrir e confirmar os mesmos valores.
   - Validar autosave e retomada sem acionar “Publicar proposta e gerar link”.
   - Revisar em 375, 390 e 430 px e desktop, incluindo teclado aberto, CTA acessível e ausência de rolagem horizontal.
   - Executar verificação de tipos, lint dos arquivos envolvidos, testes relevantes e conferir a compilação automática.

6. **Evidências e encerramento**
   - Gerar capturas de antes/depois em 390 px; como o HEAD já contém a primeira implementação, “antes” será a linha de base encontrada nesta auditoria, não a antiga sequência de 10 telas.
   - Relatar estado anterior, correções efetivas, arquivos alterados, ausência de migration, testes, riscos e situação do Git.
   - Não criar merge nem avançar para a Fase 2. Commit/PR só serão feitos se o ambiente oferecer o fluxo solicitado; caso contrário, a limitação será registrada sem inventar status.

## Detalhes técnicos
- Área principal: `OpportunityJourney`, com os helpers de jornada e testes associados.
- Fonte única: `implementation_contract_conditions`; nenhum campo comercial ou contratual será duplicado.
- A publicação versionada e seus snapshots permanecem intocados.
- Se a auditoria não encontrar uma lacuna em determinado requisito, nenhuma alteração será feita só para produzir diferença.
