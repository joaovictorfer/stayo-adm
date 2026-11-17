# Contrato: voltar para a minuta correta (VENETO_A201-2)

## O que a comparação mostrou
Comparei a minuta enviada agora com o modelo que está no sistema (CONTRATO_STAYO_02):

- **Cláusulas Gerais (Primeira a Décima-Quinta):** texto idêntico nas duas. Nada muda nelas.
- **Contratado:** volta a ser **STAYO GRAMADO** (mesmo CNPJ, sede e representante).
- **Quadro Resumo passa de 14 para 15 itens.** Diferenças no padrão:
  - **5 – Repasses:** a) automáticos pela plataforma, quando disponíveis; b) caso indisponíveis, até o dia 10 do mês seguinte ao check-out; c) chave Pix do proprietário.
  - **6 – Uso pelo contratante:** pedir com 72h de antecedência do check-in, conforme calendário e com taxa de limpeza.
  - **7 – Marketing:** mediante disponibilidade, solicitado previamente ao proprietário.
  - **11 c) Multa por cancelamento:** valor integral da remuneração do contratado, mais penalidades da plataforma (sem citar a isenção da 12.2).
  - **14 – Venda:** sem exclusividade; o contratante cumpre ou assume o custo das reservas já confirmadas.
  - **15 – Implantação (novo):** R$ 500,00 por fotos, anúncio, cadastros e assessoria inicial, mais limpeza adicional se necessário.
  - Itens 1–4, 8, 9, 10, 12 e 13: iguais ao modelo atual.
- **Assinaturas:** proprietários lado a lado; STAYO GRAMADO como contratado; bloco de testemunhas com Luana Lima de Oliveira (CPF 114.011.974-50) e segunda testemunha em branco (opcional).

## O que vou fazer
1. Trocar o modelo-base do Word por esta minuta, mudando só os dados variáveis (contratantes, imóvel, Quadro Resumo, data, assinaturas e testemunhas).
2. Atualizar os textos padrão dos itens 2 a 15 com a redação desta minuta, todos já preenchidos e editáveis na janela **Dados para contrato**.
3. Incluir o item **15 – Implantação**, com valor editável (padrão R$ 500,00).
4. Repasse: o item 5 sempre traz a) e b); a chave Pix (c) vem da ficha do proprietário. Se a ficha não tiver Pix, a linha c) fica pendente para preencher.
5. Atualizar a verificação automática: o contrato gerado tem que bater palavra por palavra com esta minuta nas Cláusulas Gerais, timbrado e formatação.
6. Conferir no navegador (computador e celular), baixar o Word do Vêneto A201 e converter em PDF para checar páginas e visual.
7. Atualizar a memória da minuta oficial para apontar esta versão.

## Detalhes técnicos
- Novo base64 em `contract-standard-template.server.ts`, novo sha256/mapa de parágrafos em `contract-template-map.json` (o Quadro agora tem 15 linhas e a tabela de assinaturas inclui testemunhas).
- `contract-standard-clauses.ts`: novos `STANDARD_CLAUSES` (itens 5, 6, 7, 11c, 14, 15) e `implementationFee`.
- `contract-document.ts` / `contract-copy.ts` / `ContractSummaryEditor.tsx` / `ContractCopyDialog.tsx`: 15 itens, Pix no item 5c, item 15 editável.
- Testes de fidelidade em `contract-document.test.ts` e `contract-certification.test.ts` apontando para a nova minuta.
