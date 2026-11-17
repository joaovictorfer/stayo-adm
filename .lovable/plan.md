# Carta de autorização à portaria do condomínio

Gerar a carta em Word com o mesmo visual do contrato (mesmo cabeçalho, logo, fonte e margens), preenchida com os dados da ficha.

## Onde fica
- Na ficha do imóvel, ao lado de "Gerar contrato", um botão **Gerar carta à portaria**.
- Abre uma janela curta para conferir e ajustar antes de baixar o Word.

## O que vem preenchido sozinho
- Nome e CPF do proprietário (se houver dois proprietários, aparecem os dois: "Nós, Fulano, CPF..., e Beltrana, CPF..., proprietários").
- Apartamento, torre e condomínio da ficha.
- Endereço oficial do condomínio (os sete endereços padronizados), e o nome do condomínio no título e no último parágrafo.
- Cidade e data de hoje por extenso ("Gramado/RS, 17 de novembro de 2026"); a cidade segue o condomínio (Gramado ou Canela).
- Gênero do texto: "proprietário/proprietária", "inscrito/inscrita" conforme o cadastro.

## O que vem padrão, mas pode ser editado na janela
- Pessoas autorizadas: STAYO (CNPJ 67.217.149/0001-06), João Victor Fernandes Dantas e Luana Lima de Oliveira. Pode remover ou incluir.
- Veículos: RXZ-6C47 e IWA-1F83. Pode remover ou incluir placas.
- Contato: (54) 99140-3953 – STAYO Gestão de Imóveis.
- Data da carta.

## Texto
O texto da carta é exatamente o que você enviou, trocando só os dados variáveis. Os hifens de quebra ("condomí-nio", "ca-dastrados", "cancela-mento") serão corrigidos para as palavras inteiras.

## Regras
- Só a equipe interna gera a carta; nada fica público e nenhum documento é gravado no sistema, só baixado.
- Se faltar CPF, apartamento ou torre, a janela avisa e não deixa gerar.

## Detalhes técnicos
- Novo `src/lib/authorization-letter.ts`: monta o `word/document.xml` da carta reaproveitando do DOCX oficial (`contrato-stayo-original.docx`) estilos, fontes, cabeçalho/rodapé e `sectPr`, verificados pelo hash já existente; só o corpo é substituído, com texto escapado.
- Nova server function `exportAuthorizationLetter` (mesmo guard `has_admin_role` do contrato), recebendo campos validados por zod; dados do proprietário/condomínio lidos no servidor da ficha.
- Novo `AuthorizationLetterDialog.tsx` na ficha, ao lado do diálogo do contrato.
- Testes: nome/CPF e condomínio substituídos, dois proprietários no plural, pessoas e placas listadas, bloqueio sem CPF, e estilos/cabeçalho do contrato preservados.
- Salvar em memória os autorizados, placas e contato padrão.
