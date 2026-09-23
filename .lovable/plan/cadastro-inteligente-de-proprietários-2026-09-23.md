# Cadastro inteligente de proprietários

## Objetivo
Evoluir apenas a tela pública de cadastro do proprietário para aceitar coproprietários/proponentes e usar os dados cadastrados como sugestões seguras no preenchimento da conta de repasse.

## O que será construído
- Na etapa **Identificação**, manter o proprietário principal e incluir uma lista de coproprietários/proponentes com a ação **Adicionar proprietário**.
- Cada pessoa terá tipo PF/PJ, nome/razão social, CPF/CNPJ e contato, com validação e possibilidade de editar ou remover antes do envio.
- Na etapa **Repasse**, exibir um seletor de titular quando houver mais de uma pessoa; quando houver apenas uma, preencher nome e CPF/CNPJ automaticamente e mostrar **Alterar titular da conta**.
- Sugerir a chave Pix conforme o tipo escolhido: CPF/CNPJ, telefone ou e-mail do titular. O campo continuará editável por meio de **Alterar chave Pix**; chave aleatória permanece manual.
- Refinar a apresentação com resumos das pessoas, estados de preenchimento, feedback visual de dados sugeridos e transições discretas, mantendo o padrão visual atual do Portal.

## Persistência e segurança
- Criar uma tabela própria para as pessoas do cadastro, vinculada à implantação, com acesso interno protegido por RLS.
- Atualizar as funções públicas protegidas pelo token para ler e salvar essa lista sem expor IDs internos.
- Preservar os campos atuais do proprietário principal para compatibilidade com Admin, Portal e integrações existentes.
- Não alterar autenticação, propostas, reservas, financeiro global ou Core.

## Validação
- Cobrir a seleção automática de titular e as sugestões de Pix com testes.
- Validar salvamento e retomada do rascunho, envio final, link inválido e múltiplos proprietários.
- Conferir a tela em celular e desktop, além de executar testes e build.
