# Contrato: preencher o Quadro Resumo com o padrão STAYO e garantir fidelidade ao anexo

## O que encontrei ao comparar o anexo (CONTRATO_STAYO_02) com o modelo atual do sistema
- **Cláusulas gerais (Primeira em diante): idênticas.** As únicas diferenças são dados variáveis (nomes, CPFs, data e assinaturas).
- **Contratado:** o anexo usa **SERRA SERV E HOSP LTDA**; o modelo atual usa **STAYO GRAMADO**. Mesmo CNPJ, mesmo representante.
- **Quadro Resumo:** o anexo tem **14 itens**; a tela de geração mostra só 9 itens, mais um "Demais condições" improvisado. Os itens 5 a 9 aparecem como "[A DEFINIR]" quando a ficha não tem texto salvo.

## O que vou fazer
1. **Padrão do anexo como texto inicial** de cada item, sempre editável pelo botão "Editar". Se você alterar, vale o texto alterado só para aquele imóvel:
   - 5 Repasses: automáticos pelo Airbnb diretamente às contas das partes.
   - 6 Uso pelo contratante: permitido sem limite prévio, conforme calendário e taxa de limpeza.
   - 7 Marketing: não autorizado, exceto imagens para divulgação no Airbnb.
   - 8 Manutenção emergencial: até R$ 300,00 sem aviso; acima disso, com autorização.
   - 9 Paralisação periódica: a cada 4 meses, com registro.
   - 10 Exclusividade: SIM, para gestão operacional e comercial.
   - 11 Multas: itens a) a d), com os valores do anexo.
   - 12 Vigência: 12 meses, com renovação automática.
   - 13 Rescisão: aviso prévio de 30 dias, respeitando as reservas.
   - 14 Venda do imóvel: sem exclusividade na venda, respeitando as reservas.
2. **Quadro Resumo com os mesmos 14 itens, títulos e numeração do anexo**, na tela, na cópia para Word e no Word baixado. O item "Demais condições" deixa de existir.
3. **Trocar o modelo-base** do Word pelo anexo. Continuo alterando só os dados variáveis (contratantes, imóvel, Quadro Resumo, data e assinaturas). Cláusulas, formatação e timbrado ficam como estão no anexo.
4. **Verificação automática de fidelidade:** um teste gera o contrato e confere que todo o texto das cláusulas gerais é igual ao do anexo, palavra por palavra. O teste também confirma que nada "[A DEFINIR]" aparece nos itens 2 a 14 quando a ficha usa o padrão.
5. Conferir no navegador (computador e celular), baixar o Word e convertê-lo em PDF para revisão visual.

## Ponto a confirmar
- Por padrão, o Contratado passa a aparecer como **SERRA SERV E HOSP LTDA**, igual ao anexo. Se preferir manter "STAYO GRAMADO", eu mantenho.

## Detalhes técnicos
- `src/lib/contract-copy.ts`: rows 1 a 14 com fallback para as constantes padrão (em `src/lib/commercial-standard.ts`). O valor salvo em `implementation_contract_conditions` tem prioridade, e `standard_copy` marca a exceção por imóvel.
- `ContractSummaryEditor`: campos novos (exclusividade, multas, vigência/renovação, rescisão, venda), já preenchidos com o padrão.
- `src/assets/contracts/contrato-stayo-original.docx` substituído pelo anexo. Regenerar `contract-template-map.json` para os intervalos permitidos.
- Teste novo em `contract-document.test.ts`: compara o texto normalizado a partir de "CLÁUSULAS GERAIS" com o texto do anexo.
- Atualizar `mem://features/minuta-contrato`.
