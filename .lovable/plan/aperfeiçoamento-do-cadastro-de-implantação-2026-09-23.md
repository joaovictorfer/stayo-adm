# Aperfeiçoamento do cadastro de implantação

## Objetivo
Corrigir a falha ao concluir a nova implantação e tornar as três etapas mais completas, inteligentes e seguras, preservando o restante do Admin e do Portal.

## O que será alterado

### 1. Proprietário
- Manter nome completo e telefone como dados principais obrigatórios.
- Criar uma área expansível para e-mail, CPF/CNPJ, endereço, chave Pix e banco.
- Permitir incluir proprietários adicionais com nome, telefone, CPF/CNPJ e e-mail.
- Aplicar máscaras, validações e normalização já usadas no domínio de proprietários.

### 2. Imóvel e condomínio
- Buscar condomínios existentes conforme o nome é digitado e permitir seleção direta.
- Quando não houver resultado, abrir confirmação e um cadastro rápido do condomínio com nome, endereço opcional e estado pendente quando incompleto.
- Adicionar torre e unidade; permitir marcar/remover torre quando o condomínio não tiver divisão por torres.
- Criar área expansível com vaga/box, rede Wi-Fi, senha do Wi-Fi, senha da fechadura e observações.
- Permitir foto do condomínio e do imóvel, mantendo imagem padrão quando nenhuma for enviada.

### 3. Condições
- Aplicar os novos padrões: limpeza R$ 250,00; repasse automático pelo Airbnb ou até o dia 10 fora da plataforma; manutenção até R$ 300,00; aviso prévio de 30 dias.
- Exibir um lápis ao lado de cada condição para edição individual, mantendo os demais valores padrão.

### 4. Salvamento e continuidade
- Corrigir a criação para gravar a implantação no banco usado pelo Admin, eliminando a divergência atual com armazenamento local.
- Salvar o rascunho automaticamente ao alterar campos, trocar de etapa, clicar fora ou fechar.
- Restaurar o rascunho ao reabrir e limpar somente após criação concluída.
- Exibir feedback claro de salvando, salvo e erro, além da mensagem real quando a conclusão falhar.

## Dados e segurança
- Adicionar somente estruturas necessárias para condomínios, proprietários adicionais e rascunhos.
- Manter fotos em armazenamento privado e registrar apenas seus caminhos.
- Preservar permissões administrativas, validação dos documentos e regras existentes.

## Validação
- Testar criação completa, fechamento com autosalvamento, retomada, condomínio existente e novo, campos expansíveis, fotos e uso em celular.
- Executar testes automatizados, lint dos arquivos alterados e build.
