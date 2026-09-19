# Fase 7 — Workspace administrativo do proprietário

## Objetivo
Transformar a ficha atual em um workspace leve e orientado à situação do proprietário, preservando dados, regras, integrações e permissões existentes.

## Estrutura
- Criar cabeçalho contextual com nome, tipo, status derivado, cinco indicadores compactos e ações principais.
- Organizar o conteúdo em abas: Resumo, Imóveis, Implantações, Contratos, Financeiro, Documentos, Portal e Histórico.
- Manter no Resumo apenas contato, estado cadastral, lista curta de imóveis, conta de repasse mascarada, pendências e atividade recente.
- Levar edição, documentos, notas, contratos, financeiro e histórico completo para suas abas correspondentes.
- Não exibir UUIDs ou detalhes técnicos na experiência principal.

## Dados e comportamento
- Relacionar todas as implantações do proprietário, incluindo vínculos principal e adicionais.
- Derivar os indicadores e o status a partir de imóveis, implantações, cadastro recebido, tarefas e acesso ao portal.
- Usar o cadastro integrado para resumir completude e conta de repasse; chave PIX sempre mascarada.
- Reaproveitar o acesso seguro do portal: visualizar quando o token estiver disponível na sessão, gerar novo acesso e revogar; nunca persistir ou revelar token em texto puro.
- “Enviar mensagem” abrirá o canal disponível do proprietário; sem contato, ficará indisponível.
- Manter documentos privados atrás das permissões já existentes; informações bancárias completas não serão exibidas no resumo.

## Segurança
- Dados bancários serão consultados por uma projeção administrativa restrita aos papéis autorizados, com a interface omitida para demais perfis.
- Documentos continuarão em armazenamento privado, com links temporários.
- A UI não será tratada como controle de acesso: permissões reais permanecem no backend.

## Validação
- Testes das derivações para proprietário com um imóvel, múltiplos imóveis e ainda em implantação.
- Teste do ciclo de acesso ao portal: criar, visualizar, gerar novo e revogar.
- Verificação desktop/mobile, abas e ausência de vazamento horizontal.
