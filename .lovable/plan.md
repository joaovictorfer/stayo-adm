# Fase 3 — Workspace da implantação

## Objetivo
Transformar a página individual em um workspace claro e orientado à próxima ação, preservando regras, dados, cálculos, APIs e funções existentes.

## Implementação
- Refatorar o cabeçalho para destacar imóvel, código, proprietário e status, com indicadores compactos em grade 2x2 no mobile.
- Organizar ações em “Portal do proprietário”, “Compartilhar”, “Gerar documento” e menu de ações; o Portal ficará apenas sinalizado para a Fase 4.
- Substituir o stepper com rolagem horizontal por uma jornada responsiva que diferencia concluído, atual, futuro, bloqueado e status alternativos.
- Criar “Próxima ação recomendada” a partir dos dados e pendências reais, com CTA que abre a aba adequada.
- Reorganizar as abas em Visão geral, Proprietário, Imóvel, Enxoval, Itens faltantes, Checklist, Proposta, Documentos e Histórico.
- Reduzir a Visão geral a dados essenciais, pendências, atividades recentes, progresso por área, responsáveis e datas relevantes.
- Mover ID e referências técnicas para uma seção recolhível com ação de copiar.
- Preservar progresso e prontidão como indicadores e cálculos independentes.

## Componentes e responsividade
- Refatorar `WorkspaceHeader` e extrair componentes reutilizáveis para jornada, próxima ação e navegação de abas.
- Usar superfícies claras e tokens semânticos existentes; eliminar o grande bloco escuro.
- Validar desktop e mobile, incluindo ações compactadas, tabs roláveis sem vazamento lateral e indicadores 2x2.

## Fora do escopo
- Não implementar o Portal do Proprietário.
- Não alterar banco, migrations, integrações, rotas ou regras de negócio.
