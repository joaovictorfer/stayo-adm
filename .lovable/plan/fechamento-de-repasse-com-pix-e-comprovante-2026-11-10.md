# Fechamento de repasse com Pix e comprovante

## O que será entregue
- No balancete do imóvel, ação **Pagar com Pix** com nome do titular, chave cadastrada e valor exato do saldo a repassar.
- QR Code Pix e **Copiar código Pix**, para pagamento no aplicativo do banco. Gerar o código não realiza transferência nem marca o repasse como pago.
- Ação **Finalizar repasse** com valor efetivamente pago, data e comprovante obrigatório em PDF, JPG ou PNG.
- Histórico do repasse com comprovante disponível apenas para a equipe financeira autorizada.
- PDF mensal mantendo o visual aprovado e acrescentando o comprovante no final: imagens em página de anexo e PDFs com todas as páginas originais, sem cortar conteúdo.

## Regras do fechamento
- Usar o saldo já calculado: somente o que a STAYO ainda deve ao proprietário, sem incluir valores pagos diretamente pelo Airbnb.
- Bloquear a geração do Pix com saldo zero/negativo, valores financeiros incompletos ou chave Pix inválida/ausente.
- Conferir novamente saldo e chave antes de confirmar; mudanças exigem revisão. Evitar duplicidade em cliques repetidos.
- Registrar o pagamento somente após confirmação explícita da equipe e salvamento bem-sucedido do comprovante. Anexar um arquivo sozinho não comprova liquidação bancária automática.
- Descontar o repasse registrado no saldo atual, preservando valor, destinatário e fechamento utilizados no pagamento. O PDF identifica o valor pago e o eventual saldo restante.
- Comprovantes serão privados: não liberar acesso pelo Portal ou por links públicos existentes.
- Falha ao carregar um comprovante impede baixar um relatório anunciado como completo; apresentar a falha para nova tentativa.

## Detalhes técnicos
- Reutilizar `payout-statement`, `payoutPdfBalance`, `payout_transfers`, os dados de `owner_payout_accounts` e o gerador local com `pdf-lib`.
- Gerar payload Pix BR Code com biblioteca adequada e QR Code local, sem serviço de pagamentos ou transmissão bancária.
- Persistir snapshot do fechamento/destinatário e vínculo do comprovante ao repasse; finalização idempotente e controle de concorrência em RPC protegida. Escritas da interface passam por `core-client` e funções autenticadas com validação de papel.
- Bucket privado específico para comprovantes financeiros, políticas restritas a super admin/admin/finance, validação de tipo real e tamanho do arquivo e URLs temporárias. Não reutilizar anexos do proprietário, pois suas permissões são diferentes.
- Integrar anexos ao PDF no navegador, preservando o relatório-base e os comprovantes originais. Limite inicial de 10 MB por comprovante.

## Verificação
- Testes de valor do Pix, bloqueios, arredondamento, registro único, concorrência, permissões, preservação de pagamentos Airbnb e cálculo após repasse.
- Conferir QR Code com leitura independente e download do PDF com anexos de imagem e PDF, incluindo documento multipágina.
- Validar fluxo autenticado no computador e celular com dados descartáveis; não registrar pagamento fictício no C203 ou Ravena nem realizar Pix real.