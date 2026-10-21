# Área de cobranças STAYO — telas e implantação em fases

## Objetivo
Criar uma central para cobrar serviços e reembolsos por link: cobrança avulsa, vinculada a um imóvel desde a criação ou vinculada posteriormente. O destinatário abre uma página profissional, confere os itens e escolhe Pix ou cartão via Pagar.me.

O PDF enviado será referência de organização, não uma cobrança a importar: a FSR-053 já aparece como paga. Não gerar cobrança nova nem reaproveitar seu QR Code estático.

## Regras do produto
- Cada item tem descrição, quantidade, valor unitário e total; o subtotal é a soma dos itens.
- **Pix:** subtotal integral, sem acréscimo.
- **Cartão de crédito:** subtotal + **5%**, com acréscimo e total discriminados antes de pagar. Exemplo do PDF: subtotal R$ 250,00; Pix R$ 250,00; cartão R$ 262,50, incluindo R$ 12,50 de acréscimo.
- Avulsa não significa anônima: identificar o destinatário, mas não exigir vínculo com imóvel para criar a cobrança.
- Vincular um imóvel depois não muda destinatário, itens ou valores de uma cobrança publicada/paga; o vínculo é administrativo e auditado. Mostrar nova capa/contexto ao cliente exige atualização explícita da apresentação.
- Depois de publicada, correções financeiras exigem cancelamento/substituição com histórico, não edição silenciosa. Cobrança paga não pode ser apagada ou cancelada como se não tivesse sido paga.
- Não implementar parcelamento, pagamentos parciais, estornos automáticos nem emissão fiscal nesta primeira entrega.

## Telas

### 1. Central de cobranças — Admin / Financeiro
Indicadores próprios: valor em aberto, recebido e vencido. Lista com código, destinatário, imóvel ou “Avulsa”, vencimento, valor e situação. Busca e filtros por imóvel, período e status.

Ações: nova cobrança, abrir detalhe, editar rascunho, vincular imóvel, pré-visualizar, publicar/copiar link e cancelar cobrança não paga, conforme permissão e situação. Estados completos de carregamento, vazio real, erro e acesso restrito; sem números inventados.

### 2. Criar/editar cobrança
Fluxo curto: **destinatário e imóvel opcional → itens → revisão**. Reutilizar cadastros existentes sem duplicar proprietários. Permitir destinatário avulso com dados mínimos necessários ao pagamento.

Campos: título, competência opcional, vencimento, descrição dos itens, quantidade, valor unitário, observação visível ao cliente e nota interna separada. Resumo com subtotal, Pix e cartão +5%. Foto do imóvel quando disponível e autorizada; sem foto, cabeçalho STAYO limpo.

### 3. Detalhe administrativo
Documento, vínculo, histórico de publicação, tentativas de pagamento, situação confirmada e ações seguras. Serviço concluído, cobrança enviada e pagamento confirmado são informações diferentes — não confundir.

### 4. Página do destinatário
Logo oficial, capa autorizada quando houver, título, código, contexto do imóvel, emissão/competência/vencimento, itens e subtotal. Seguir a hierarquia visual do PDF com **azul-marinho, branco e dourado**, Outfit/Figtree e toque confortável no celular.

Seleção **Pix — R$ …** / **Cartão — R$ … (+5%)**, seguida de pagamento. No Pix, QR Code e copia e cola reais emitidos pela Pagar.me, com validade. Para cartão, preferir checkout hospedado, sem campos de cartão armazenados pela STAYO.

Estados: cobrança disponível, processamento, pagamento confirmado, tentativa recusada, Pix expirado, cobrança cancelada, link expirado/revogado e falha temporária. Só mostrar “Paga” após confirmação verificada; retorno do checkout não é comprovante.

## Fases e entregas

### Fase 1 — Aprovação visual e fluxo navegável
Construir protótipo isolado da central, criação, detalhe e página do destinatário, com prévia de Pix/cartão e vínculo posterior. Usar exemplo fictício claramente demonstrativo; não publicar links pagáveis, gerar QR Codes ou alterar registros financeiros reais.

**Validação:** celular e desktop, itens/subtotal, R$ 250,00 → R$ 262,50 no cartão, fluxo avulso → vínculo com imóvel, logo/capa/fallback e todos os estados essenciais. Nesta fase não há cobranças persistentes nem recebimento de dinheiro.

### Fase 2 — Cadastro real, publicação e segurança
Implementar armazenamento, permissões, rascunhos, histórico, vínculo posterior e link seguro revogável. Lista e indicadores usam dados reais. Publicação habilita consulta da cobrança, mas não pagamento antes da integração estar pronta.

Reutilizar fontes de faturas e cobranças iniciais quando aplicável, com origem única e proteção contra duplicação. Não converter automaticamente faturas já pagas em novas cobranças.

**Validação:** criar rascunho avulso, salvar e recarregar, vincular imóvel, publicar, consultar por link, revogar e conferir histórico. Testar acesso negado entre contas e ausência de dados internos/sensíveis na página pública.

### Fase 3 — Pagar.me em ambiente de teste
Conectar a conta Pagar.me pelo fluxo seguro e validar os recursos habilitados. Valores sempre calculados no servidor. Preferir selecionar o método na página STAYO e criar tentativa/checkout restrito ao método e total escolhidos, evitando cobrar cartão pelo valor de Pix.

Confirmar antes da implementação: suporte de links a método único, variação de valor por método, endpoint de teste, deduplicação de criação e mecanismo de autenticação das notificações. Se o checkout não suportar a regra, ajustar o fluxo de tentativas sem substituir o provedor nem alterar os 5%.

Uma cobrança pode ter várias tentativas, mas somente uma quitação. Bloquear cliques/criações concorrentes e reconciliar timeout antes de repetir. Se uma cobrança for paga, inutilizar tentativas pendentes quando o provedor permitir; detectar pagamento duplicado e sinalizar ao financeiro, sem gerar estorno automático.

**Validação:** Pix, cartão +5%, recusa, expiração, reload, callbacks repetidos/fora de ordem, tentativa de alterar valores e pagamento concorrente. Nenhuma transação real.

### Fase 4 — Operação real e conciliação
Depois da aprovação dos testes e autorização explícita, ativar pagamentos reais. Atualizar status e indicadores pelo pagamento confirmado, reconciliar falhas de comunicação e permitir compartilhar o link. PDF continua como demonstrativo complementar; o link é o caminho de pagamento.

**Validação:** fluxo real autorizado de ponta a ponta, confirmação lida tanto no Admin quanto na página do destinatário, valores/método consistentes e histórico auditável. Não marcar esta fase concluída com teste simulado.

### Fase futura — Nota fiscal por e-mail
Projeto separado: escolher emissor fiscal, validar empresa emitente, natureza dos serviços e dados fiscais exigidos; emitir após quitação elegível e enviar por e-mail com histórico e tratamento de falhas. **Não emitir nem enviar nota fiscal agora.** Demonstrativo/recibo de pagamento não deve se apresentar como nota fiscal.

## Arquitetura técnica
- **Integração aditiva:** financeiro existente continua preservado; cobranças são recebimentos de clientes, não repasses a proprietários nem despesas. Não alterar integração VF ou canais/PMS.
- **Rotas propostas:** protótipo isolado na Fase 1; nas fases reais, `/financeiro/cobrancas`, `/financeiro/cobrancas/nova`, `/financeiro/cobrancas/$id` e `/cobranca/$token`. Criar todos os arquivos de rota junto com os links; cada tela tem metadados próprios. Links privados de cobrança sem indexação e sem CPF, nome do destinatário ou imagem privada em prévias sociais.
- **Domínio:** cobrança, itens, apresentação publicada versionada, vínculo com imóvel/implantação, tentativas de pagamento e eventos auditados. Imóvel é opcional; IDs do provedor e referência à origem têm unicidade apropriada. Valores em centavos inteiros, BRL e cálculo único servidor/validação compartilhada.
- **Estados independentes:** rascunho/publicação/cancelamento; pagamento pendente/processando/pago; atraso derivado de vencimento sem sobrescrever quitação. Recusa/expiração pertencem à tentativa, não apagam a cobrança.
- **API:** respeitar a fronteira existente em `core-client.ts`; ações passam pelo cliente de domínio e funções de servidor autenticadas, sem escrita direta no componente. Pagar.me só no servidor com `fetch` compatível com o runtime; credenciais nunca no navegador.
- **Permissões:** reutilizar verificação canônica do time financeiro/admin e permissões do proprietário por imóvel; não presumir que convite de implantação concede acesso financeiro. Políticas RLS e GRANT explícitos para novas tabelas; novas regras de papel exigem testes.
- **Link:** capacidade própria, aleatória, com token armazenado como hash, expiração/revogação e escopo apenas daquela cobrança. Não reutilizar tokens de inventário, proposta ou convite. Sem acesso a outras cobranças, dados bancários pessoais, CPF completo, hóspedes ou notas internas.
- **Capas:** autorização própria de cobrança, reaproveitando o padrão de imagem privada e URL assinada; nunca tornar a foto pública globalmente para compor uma capa.
- **Checkout:** total, método, destinatário e IDs derivados da cobrança publicada no servidor, nunca do valor enviado pelo navegador. Guardar apenas referências/estado; não armazenar PAN/CVV. Os dados obrigatórios variam por conta e meio e serão confirmados em teste.
- **Notificações:** endpoint externo em `/api/public/pagarme/webhook`, com validação da origem conforme o mecanismo oficial verificado. Consultar pedido/pagamento por API autenticada e conferir ambiente, conta, IDs, método, moeda, total e estado antes de quitar; notificações não verificadas não fazem escrita financeira. Não inventar um header de assinatura.
- **Deduplicação:** transações/locks locais por cobrança e tentativa, unicidade dos eventos, reconciliação após timeout. Usar idempotência Pagar.me somente se confirmada para o endpoint escolhido.
- **QA:** testes específicos das regras Pix integral, cartão +5% e centavos, vínculo sem mutação financeira, imutabilidade após publicação, quitação única e permissões; validação ponta a ponta e estados mobile/desktop com fixture descartável.

## Dependências e referências
A Fase 1 pode começar sem credenciais. Fases de pagamento dependem da conta Pagar.me, recursos contratados, acesso de teste e autorização para ativação real; serão solicitados por conexão/formulário seguro, nunca pelo chat.

Documentação oficial consultada:
- [Criar link de pagamento](https://docs.pagar.me/reference/criar-link)
- [Configuração de checkout/link](https://docs.pagar.me/reference/checkout-link)
- [Checkout Pagar.me](https://docs.pagar.me/reference/checkout-response)
- [Autenticação](https://docs.pagar.me/reference/autentica%C3%A7%C3%A3o-2)
- [Webhooks](https://docs.pagar.me/reference/vis%C3%A3o-geral-sobre-webhooks)

**Aprovação deste plano inicia a Fase 1; não habilita recebimentos reais nem emissão fiscal.**