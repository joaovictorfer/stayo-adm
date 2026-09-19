# Fase 5 — Cadastro integrado do proprietário

## Objetivo
Transformar “Complete seus dados” em uma tarefa do Portal do Proprietário, com cinco etapas curtas, salvamento de rascunho e retomada pelo mesmo link seguro.

## Implementação
- Evoluir o cadastro para PF/PJ, contato, endereço, conta principal de repasse e revisão, com validação via Zod, máscaras e limites de tamanho.
- Criar persistência de rascunho protegida pelo token do portal: o banco armazenará somente o hash do token e as funções públicas devolverão/gravarão exclusivamente o cadastro vinculado àquele acesso.
- Manter dados bancários fora do snapshot público, logs e armazenamento do navegador; eles serão enviados diretamente ao backend e acessíveis internamente apenas pelos perfis autorizados.
- Pré-preencher nome, telefone e e-mail quando já disponíveis, sem bloquear alterações.
- Integrar o início/retomada na tarefa “Complete seus dados” dentro de “Precisamos de você”, mantendo o painel de acompanhamento acessível.
- Reutilizar a busca de CEP existente com preenchimento automático e fallback manual.
- Implementar seleção pesquisável de banco, todos os tipos de PIX, sugestões coerentes com o cadastro e opção “Usar outro”.
- Ao concluir, manter o portal aberto e exibir “Cadastro recebido” com a mensagem de validação pela equipe Stayo.

## Segurança
- Validar no cliente e novamente nas funções do banco.
- Não registrar CPF/CNPJ, dados bancários, PIX, telefone ou e-mail em logs do frontend.
- Não devolver dados bancários na resolução geral do portal; somente na operação específica de rascunho autenticada pelo token.
- O envio final não invalida o link do portal.

## Validação
- Testar PF e PJ, CEP válido/falha manual, cinco tipos de PIX, sugestões de preenchimento e opção “Usar outro”.
- Testar salvar/sair/retomar e envio final, incluindo atualização da tarefa no portal.
- Validar desktop e mobile sem vazamento horizontal.
- Rodar TypeScript e testes automatizados relevantes.
