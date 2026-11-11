## Importação e revisão
1. Anexar PDF ou imagem, indicar orçamento, pedido ou nota fiscal e selecionar o imóvel.
2. Extrair fornecedor, número, data, itens, códigos, medidas, cores, quantidades, valores, desconto e frete.
3. Exibir uma prévia para conferir a leitura, resolver diferenças e relacionar cada produto ao catálogo. A leitura automática não confirma a compra nem a entrega.
4. Ao confirmar o pedido, preservar os itens e valores daquela versão. Correções exigem motivo e histórico, sem sobrescrever a referência usada na entrega.
5. Incorporar os itens à implantação sem duplicar a mesma compra ao reenviar o documento.

## Documentos enviados — Ravena B502
O pedido **05580**, de **10/11/2026**, pertence integralmente ao B502, conforme sua confirmação.

| Informação | Orçamento | Pedido confirmado |
|---|---:|---:|
| Valor dos itens | R$ 5.861,52 | R$ 5.861,52 |
| Desconto | Não indicado | R$ 175,85 (3%) |
| Frete | Sob consulta | R$ 0,00 |
| Total | R$ 5.861,52 | **R$ 5.685,67** |

O pedido tem **17 linhas** e informa **107 unidades**, incluindo **53 identificações**. Identificações são serviço/acessório de identificação, não conjuntos adicionais de enxoval. Entrega prevista: **23/12/2026**. O documento declara pagamento por Pix em 10/11; essa informação será registrada como declaração do fornecedor, sem gerar pagamento financeiro no sistema. **Pedido de venda não é nota fiscal.**

Diferenças que aparecerão na revisão:
- Manta solteiro: orçamento indica 1,50 × 2,00; pedido indica 1,50 × 2,20.
- Protetor de colchão solteiro: orçamento indica comprimento 1,98; pedido indica 1,88.
- Identificação: orçamento fala em bordado “Ravena B502”; pedido registra bandeira de identificação.
- Cores das mantas: orçamento cita gelo/cinza; pedido especifica marrom escuro.

O pedido define o que foi comprado; diferenças em relação às camas ou ao mínimo geram alerta, nunca aprovação automática. Edredons, protetores e travesseiros que não atingirem o mínimo duplicado serão apontados para verificação do estoque já existente.

## Referências de preço
- Manter fornecedor, código, especificação, data e documento de origem para cada preço verificado.
- Separar preço unitário de tabela e custo efetivo com desconto/frete, com rateio em centavos que fecha no total do documento.
- Orçamento permanece referência de cotação; pedido confirmado alimenta a referência de compra. Documento antigo não substitui uma referência mais recente.
- Nova estimativa considera apenas o que falta comprar; item sem preço compatível aparece como **sem cotação**, nunca como custo zero.
- Mudanças futuras de preço ou do padrão mínimo não alteram pedidos anteriores.

## Conferência da entrega
Registrar recebimentos parciais por item, quantidades em bom estado, defeitos, diferenças de medida/cor e fotos. Um pedido só fica **conferido** quando todas as quantidades e divergências estiverem resolvidas. Enxoval comprado continua distinto de enxoval recebido e aprovado.

## Implementação técnica
- Reutilizar ambientes/camas de `implementation_amenities`, os guias e a lista de pendências existentes; respostas anteriores e capacidades do proprietário permanecem preservadas.
- Acrescentar estruturas de regras versionadas, documentos, itens de pedido, referências de preço e eventos de recebimento, com vínculo à implantação e histórico auditável.
- Tipos compartilhados em `src/types/core.ts`; escritas por `src/lib/api/core-client.ts`, com funções autenticadas e validação de papel, revisão e conflitos.
- Documentos privados, URLs temporárias e leitura automática no servidor; não expor PDFs de compra por links públicos ou pelo portal sem liberação específica. A análise automática usa Lovable AI e consome créditos por documento.
- As mudanças na estrutura de dados acontecem apenas neste draft agora; entram no app ao aceitar o draft. Os dados deste draft não são transferidos para o app.
- Testar duplicação por cama, quantidades existentes, preços ausentes, desconto de R$ 175,85, total de R$ 5.685,67, reenvio idempotente, bloqueio de acesso e recebimento parcial/completo. Validar o fluxo real de revisão e conferência no computador e celular.

**Fora de escopo:** realizar Pix, criar cobranças, alterar repasses, atualizar estoque operacional no STAYO APP ou liberar documentos ao proprietário automaticamente.