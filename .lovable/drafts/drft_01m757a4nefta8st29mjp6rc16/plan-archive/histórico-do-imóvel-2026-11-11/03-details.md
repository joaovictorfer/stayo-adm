## Acompanhamento, não apenas anotações
**Exemplo: compra de enxoval**
1. Registrar compra, fornecedor, quantidade e previsão de entrega.
2. Marcar “Aguardando entrega”. A compra permanece nas pendências mesmo ao mudar o mês.
3. Registrar recebimento com data e quantidade efetivamente recebida — inclusive entrega parcial.
4. Registrar conferência: quantidade aprovada, itens faltantes ou divergência.
5. Concluir apenas após conferência completa; faltas permanecem visíveis até a resolução.

Todas essas etapas pertencem à **mesma ocorrência**. A linha do tempo mostra quando cada etapa aconteceu e permite abrir a compra original. Cada atualização guarda autor e momento do registro. Correções acrescentam uma retificação com motivo, preservando o conteúdo anterior.

**Manutenção e higienização:** aberta → agendada/em andamento → realizada → conferida/concluída, ou cancelada com motivo. Concluir um serviço não significa que foi pago.

**Vistoria e ocorrência:** registro pontual ou acompanhamento de pendência com atualizações vinculadas. Aqui se registra o acontecimento; não será criado um novo sistema de vistorias nesta etapa.

## Reservas e implantação existentes
- Reaproveitar eventos de implantação, propostas, decisões e registros já disponíveis, sem duplicá-los e sem exibir autosaves repetitivos como acontecimentos.
- Mostrar reservas disponíveis no Admin, vinculadas ao imóvel correto, com código, canal, período e acesso ao detalhe existente. Numerar 1ª, 2ª, 3ª somente quando houver uma sequência histórica completa; caso contrário, mostrar o código e informar que o histórico de reservas é parcial.
- Uma data de entrada não prova realização da hospedagem. Sem informação confiável de situação, mostrar o período conhecido, sem inventar check-in realizado ou cancelamento.
- Datas antigas sem horário mostram somente a data. Não apresentar meia-noite como se fosse um horário conhecido.
- Não fabricar acontecimentos passados a partir do estado atual de um item. O acompanhamento detalhado começa com os registros efetivamente disponíveis e as novas atualizações.

## Etapas de entrega
1. **Base e consulta:** histórico consolidado, fases, categorias, filtros, busca, paginação e detalhes das fontes existentes.
2. **Registros e acompanhamento:** inclusão manual, compras/entregas/conferências, serviços, retificações e pendências persistentes.
3. **Validação:** fluxo completo de compra até conferência, entrega parcial, correção com motivo, filtros por data/categoria, continuidade após implantação e acesso restrito; conferir computador e celular.

## Detalhes técnicos
- Manter a identidade do imóvel pela ficha e pelo vínculo externo existente; nunca associar por nome semelhante. Adaptadores unem as fontes existentes em uma apresentação comum com identificadores estáveis.
- Novas ocorrências e suas atualizações terão armazenamento próprio, com trilha imutável, prevenção de duplicidade em tentativas repetidas e controle de concorrência para evitar perda de atualizações.
- Escritas entram por `src/lib/api/core-client.ts`; tipos compartilhados em `src/types/core.ts`. Permissões administrativas são validadas no servidor e no acesso aos dados; nenhum acesso público ou pelo proprietário será adicionado.
- Separar `occurred_at` de `created_at`, preservar a precisão da data e exibir horários conhecidos em `America/Sao_Paulo`. Fase é registrada no acontecimento, sem reclassificar todo o passado pelo status atual do imóvel.
- Atualizações novas do fluxo de compras existente devem registrar a mudança junto da alteração original, sem criar um segundo cadastro de inventário ou fornecedor. Quantidades previstas, recebidas e conferidas permanecem distintas.
- Falhas de uma fonte são indicadas como histórico incompleto, nunca tratadas como ausência de acontecimentos. Consulta paginada e filtros aplicados às fontes, sem o limite silencioso de 300 registros da consulta atual.
- Não ativar nova integração, importação automática ou conexão produtiva com o STAYO App. A leitura completa das reservas externas depende de autorização e homologação já exigidas pelo projeto.
- Alterações necessárias para guardar o histórico afetam inicialmente apenas este draft. Ao aceitá-lo, a nova estrutura chega ao app; os dados próprios deste draft não são transferidos.

**Fora desta entrega:** pagamentos, mudanças nos cálculos de repasse, bloqueios de calendário, mensagens, publicação no Portal e novo motor de vistorias.