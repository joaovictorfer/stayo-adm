# Corrigir criação de acesso do proprietário

## Objetivo
Garantir que, após concluir o cadastro, o proprietário consiga definir a senha e entrar no portal sem voltar ao formulário.

## Alterações
- Reutilizar uma conta já criada quando o mesmo e-mail tentar concluir novamente, validando a senha antes de vincular.
- Completar automaticamente o vínculo após confirmação de e-mail ou login, usando o mesmo link seguro.
- Reparar links antigos sem proprietário associado a partir do cadastro finalizado, sem duplicar registros.
- Exibir mensagens específicas para senha incorreta, e-mail aguardando confirmação e acesso já vinculado.
- Após o vínculo, encaminhar diretamente para o Painel do Proprietário.

## Segurança
- Manter a validação do token, prazo e revogação no banco.
- Nunca vincular pelo ID enviado pelo navegador; a conta será identificada pela sessão autenticada.
- Impedir que um proprietário já vinculado seja assumido por outra conta.

## Validação
- Testar conta nova, e-mail já cadastrado, retorno após confirmação e vínculo antigo ausente.
- Confirmar que a senha funciona no login e que o acesso abre o portal.
