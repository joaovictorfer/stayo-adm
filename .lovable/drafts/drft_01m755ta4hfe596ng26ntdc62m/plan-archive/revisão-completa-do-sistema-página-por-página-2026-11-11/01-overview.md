# Revisão completa do sistema, página por página

## O que já verifiquei agora
- **394 testes automáticos, todos passando** (62 arquivos): repasses, Pix, cobranças, contrato, CEP, enxoval, inventário.
- **91 páginas** no sistema, sendo **18 protótipos** (telas de demonstração misturadas às reais).
- Telas muito grandes e mais sujeitas a erros: jornada do proprietário (2.608 linhas), jornada da oportunidade (2.418), portal início (2.036), ficha de implantação (1.817).
- **145 pontos** em que o código "força" tipos de dados, escondendo possíveis erros.
- **194 cores fixas** fora da paleta oficial azul-marinho.

No modo de planejamento não consigo navegar logado pelas telas; esse é o primeiro passo ao aprovar.

## Etapa 1 — Teste navegando em cada página (sem alterar nada)
Entro logado e abro as 91 páginas, no computador e no celular, registrando: erros, dados que não carregam, botões sem ação, lentidão, textos em inglês, valores sem formato R$, CEP sem busca, telas vazias sem explicação.
Fluxos de ponta a ponta: oportunidade → contrato → ativação; repasse → PDF → Pix → comprovante; cobrança; enxoval (pedido → recebimento); links públicos do proprietário.

## Etapa 2 — Relatório de melhorias
Lista priorizada (crítico / importante / desejável), página por página, com prints. **Nada é alterado** até você escolher.

## Sugestões que já se desenham
1. Tirar os 18 protótipos do menu (área "Laboratório") ou removê-los.
2. Dividir as 4 telas gigantes, sem mudar o visual.
3. Trocar cores fixas pela paleta oficial.
4. Reduzir os tipos forçados, começando por repasses e cobranças.
5. Nenhum erro virar "sucesso" silencioso.
6. Verificação de segurança completa com resumo.
