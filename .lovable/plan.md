# Portal do Proprietário por imóvel

## Objetivo
Transformar o portal em uma visão confiável por imóvel, mantendo o visual atual, eliminando carregamentos desnecessários e incluindo cronograma, vistorias e dados completos do imóvel.

## O que será construído
- Adicionar um seletor de imóvel quando o proprietário tiver mais de um, mantendo cada imóvel com painel, fase, proposta, documentos, pendências e histórico próprios.
- Vincular também coproprietários às implantações, sem alterar o modelo de acesso da conta.
- Criar a área **Dados do imóvel** no cadastro do proprietário e no painel administrativo, com endereço, tipo de acesso, chave ou fechadura, senha, Wi‑Fi e observações.
- Permitir que proprietário e equipe atualizem esses dados, com autosalvamento, revisão e proteção dos campos sensíveis.
- Substituir os marcos genéricos por uma linha do tempo real por imóvel, reunindo automaticamente proposta, previsão, etapas públicas concluídas e vistorias, além de atualizações manuais publicadas pela equipe.
- Criar a área **Vistorias** desde a implantação, com data, tipo, status, observação pública e documentos/fotos liberados.
- Manter estados honestos quando ainda não houver datas, vistorias, documentos ou etapas publicadas.

## Desempenho e experiência
- Carregar primeiro apenas conta, proprietário e lista de imóveis.
- Buscar propostas, documentos, vistorias e demais dados somente para o imóvel selecionado e quando a área correspondente for aberta.
- Reduzir atualizações e renderizações desnecessárias, preservar a seleção após atualizar a página e manter o uso fluido no celular.
- Exibir falhas por seção com tentativa novamente, sem bloquear o portal inteiro.

## Dados e segurança
- Criar estruturas próprias para detalhes do imóvel, vistorias e publicações da linha do tempo, todas vinculadas à implantação.
- Aplicar acesso restrito: proprietário vê e altera somente imóveis ligados à sua conta; equipe mantém acesso conforme função.
- Senhas de fechadura e Wi‑Fi não entram em registros de atividade, mensagens ou linha do tempo.
- Documentos continuam privados e só aparecem quando vinculados ao imóvel e liberados ao proprietário.

## Integração administrativa
- Atualizar a ficha do proprietário para listar todos os imóveis e abrir o painel individual de cada um.
- Atualizar a ficha da implantação para editar dados do imóvel, publicar atualizações e registrar vistorias/documentos.
- Reutilizar o cadastro e os componentes atuais, sem alterar reservas, financeiro global, autenticação ou o contrato futuro do Core.

## Validação
- Testar proprietário com um imóvel e com vários imóveis.
- Testar troca de imóvel, atualização da página, autosalvamento, timeline vazia/preenchida e vistorias com/sem documentos.
- Validar permissões, carregamento, erro, celular e desktop.
