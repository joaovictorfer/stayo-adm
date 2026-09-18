# Central de Implantação Stayo — evolução em fases

O documento enviado descreve uma evolução grande (fases A a J). Nada será reconstruído do zero: o que já existe (implantação, proposta versionada, portal por link, ficha do proprietário, cobranças, PDF, banco com 15 migrações, login e permissões) será evoluído.

## O que já existe hoje (verificado)

- Implantação com ficha detalhada, checklist, progresso e prontidão, aba de proposta versionada.
- Proprietários com ficha, notas internas, tarefas, condições comerciais e cobranças iniciais.
- Portal do proprietário por link com token (convite, onboarding, proposta) e login próprio.
- Banco já criado para proprietários, implantações, propostas, templates de checklist, convites, cobranças, anexos e auditoria.
- Geração de PDF de proposta já existente.

## O que ainda não existe

- Múltiplos proprietários/proponentes por implantação (hoje é um só).
- Cadastro estruturado do imóvel: CEP com busca automática, endereço, acessos, Wi‑Fi, quartos, banheiros, ambientes.
- Enxoval e Itens faltantes.
- Modelos de implantação (clonar configuração inteira) e "salvar como modelo".
- Confirmação campo a campo (o que a Stayo informou × o que o proprietário confirmou ou alterou) e fila de revisão.
- Portal como landing page com conteúdo institucional editável no Admin.
- PDFs de enxoval, itens faltantes e resumo da implantação.

## Ordem de entrega

**Fase 1 — Auditoria escrita + workspace da implantação**
Relatório `docs/OWNER_IMPLEMENTATION_UX_AUDIT.md` classificando cada peça em manter/evoluir/refatorar/remover. Em seguida, a ficha da implantação deixa de parecer formulário: cabeçalho com código, imóvel, proprietário, status, progresso, prontidão e pendências; ações (abrir portal, compartilhar, gerar documento); navegação interna por seções; bloco "Precisamos de atenção" com os bloqueadores reais.

**Fase 2 — Proprietários e confirmação de dados**
Vários proprietários/proponentes por implantação (papel, participação, endereço), sem campos fixos duplicados. Estado de cada informação: não informado, preenchido pela Stayo, confirmado, alterado pelo proprietário, revisado. Tela de revisão das alterações recebidas, sem sobrescrever dado crítico em silêncio.

**Fase 3 — Imóvel**
Cadastro estruturado com busca de endereço por CEP (serviço isolado, com preenchimento manual como alternativa), acessos, Wi‑Fi, quartos com camas, banheiros e outros ambientes.

**Fase 4 — Enxoval e itens faltantes**
Dois módulos dentro da implantação, com itens livres (nada fixo no código), quantidade necessária/existente/faltante, ambiente, tamanho, status, responsável, prioridade e sinalização de bloqueio — ligados às pendências e à prontidão. Templates de enxoval aplicáveis e salváveis.

**Fase 5 — Modelos e proposta**
Criar implantação do zero ou a partir de um modelo (o modelo é copiado, nunca fica ligado). "Salvar como modelo" escolhendo o que entra, sem dados pessoais. Proposta com condições configuráveis (percentual, valor fixo, único, por reserva, mensal), prazo, blocos de regras e observações com visibilidade por destino, mantendo o versionamento atual.

**Fase 6 — Portal como landing page**
Portal redesenhado, mobile-first: boas-vindas, apresentação da Stayo, proposta, como será a implantação, dados do proprietário e do imóvel, acessos, Wi‑Fi, pendências e confirmação — com os dados que a Stayo já tem pré-preenchidos. Conteúdo institucional editável em Configurações por blocos (rascunho e publicado), com "visualizar como proprietário".

**Fase 7 — PDFs e QA**
PDFs de enxoval (completo e só faltantes), itens faltantes e resumo da implantação, reaproveitando o gerador atual. Teste do fluxo completo ponta a ponta, desktop e celular.

## Notas técnicas

- Reuso obrigatório de `AdminApiClient` / `CoreApiClient`; nenhuma tela chama Supabase ou APIs externas diretamente.
- Novas tabelas só depois de reconciliar com as 15 migrações existentes; cada tabela nova sai com GRANT + RLS na mesma migração.
- Portal público continua por token com hash, expiração e revogação; o identificador da implantação nunca vem do navegador sem validação.
- Senhas de Wi‑Fi, fechadura e chaves são dados protegidos: nunca em log de auditoria nem em PDF público.
- Modelos aplicados viram cópia (snapshot); alterar o modelo depois não altera implantações existentes.

## Entrega

Cada fase é entregue e revisável separadamente. Se preferir, posso começar pela Fase 1 e seguir automaticamente para as seguintes.
