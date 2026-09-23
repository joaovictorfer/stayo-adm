# Painel do Proprietário — correção e reconstrução

## Objetivo
Fazer `/portal/inicio` abrir de forma confiável após o login e entregar um painel claro, profissional e apresentável, preservando o cadastro, os vínculos, as permissões e os dados existentes.

## O que será construído
- Corrigir o carregamento infinito: separar os estados de sessão, busca da conta, conta sem vínculo, erro e sucesso; nenhum erro ficará representado por um skeleton eterno.
- Tornar a sessão resiliente: validar o usuário atual, buscar o vínculo fora do evento de autenticação e permitir nova tentativa ou saída segura quando houver falha.
- Criar uma entrada acolhedora com marca STAYO, saudação, imóvel, etapa atual e próxima ação prioritária.
- Simplificar a navegação por momento do imóvel:
  - Implantação: Visão geral, Minha implantação, Meus dados, Proposta e Documentos.
  - Operação: liberar gradualmente Reservas, Calendário, Meu imóvel, Vistorias, Manutenções e Financeiro.
- Reorganizar a visão geral em poucos blocos: ação necessária, progresso, próximo marco e atualizações.
- Refinar todas as áreas já existentes com estados de vazio, erro, carregamento e sucesso consistentes.
- Aplicar visual mobile-first em navy, branco e verde suave, tipografia Sora/Manrope, controles maiores e microinterações discretas.

## Segurança e dados
- Manter o acesso vinculado à conta autenticada e às regras atuais do banco.
- Não expor notas internas, tokens, credenciais, dados de hóspedes, prestadores, custos ou margens.
- Não inventar indicadores operacionais; quando não houver dados, mostrar estados honestos.
- Preservar o mesmo portal durante implantação, transição e operação.

## Validação
- Testar sessão válida, sessão expirada, conta sem vínculo, erro de rede e carregamento.
- Validar navegação e saída da conta em desktop e celular.
- Confirmar que cadastro, proposta, documentos e módulos progressivos continuam funcionando.
- Rodar testes, lint e compilação antes da entrega.
