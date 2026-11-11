# Auditoria da geração de contratos — 11/11/2026

## Conclusão

A geração básica funciona, mas **não está pronta para ser certificada como perfeita**. Foram reproduzidas falhas em validação, valores por extenso e consistência entre o formulário visível e o arquivo preparado. Nenhuma cláusula ou comportamento de produção foi alterado nesta auditoria.

## Verificações executadas

- 26 testes existentes aprovados: minuta (8), padrão comercial (10), condições (4), status (4).
- 50 gerações adicionais com nomes, caracteres especiais, datas válidas, taxas inteiras/fracionárias, vigências, repasses e exclusividade diferentes. Partes do Word externas ao texto principal preservadas; dados pessoais do modelo não permanecem nesses casos.
- Arquivos obtidos pelo download real e por geração local abriram como pacotes Word válidos; validação formal aprovada em dois documentos adicionais.
- Fluxo autenticado em cadastro de exemplo: conferir, completar testemunhas, preparar e baixar.
- Bloqueio de segunda testemunha ausente; alteração depois do preparo invalida corretamente o arquivo já pronto.
- Limites inválidos rejeitados no servidor (taxa acima de 100%, valores negativos, vigência fracionária, textos acima do limite).
- Sem sessão e com ficha inexistente: respostas sem documento. O transporte de funções retornou HTTP 200 para a resposta serializada de erro; não interpretar esse status isoladamente como autorização.
- Desktop 1280×1800, tablet 838×626, celulares 390×844 e 320×700: sem transbordamento horizontal; nenhuma exceção no navegador.
- Conferência anterior na mesma sessão de trabalho: arquivo-base idêntico ao Ravena 106, propriedades e partes fixas preservadas; mesmas informações renderizam identicamente em dez páginas no conversor disponível.

## Falhas reproduzidas — prioridade alta

### 1. Documento preparado pode não corresponder aos campos visíveis

**Reprodução:** atrasar a requisição de geração, clicar Preparar e alterar a chave Pix enquanto ela está em andamento. O formulário mostra a chave nova, mas o Word entregue contém a anterior.

**Causa:** `ContractDocumentDialog.tsx` aceita edições durante `busy`; o resultado da requisição antiga chama `setFile` sem conferir a revisão dos campos.

**Ajuste proposto:** associar geração à revisão e à sessão de abertura do diálogo; descartar respostas antigas, bloquear edições durante preparo ou exigir nova geração após qualquer mudança. Invalidar também respostas de um diálogo já fechado. Não resolver apenas com aparência de botão desativado.

### 2. Centavos contradizem o valor por extenso

**Reprodução:** implantação 600,50 é aceita e baixada como `R$ 600,50 (seiscentos e um reais)`.

**Causa:** `reais()` em `contract-document.ts` arredonda para inteiro, enquanto a moeda mantém centavos.

**Ajuste proposto:** uma única representação em centavos para moeda e extenso, com suporte a reais/centavos; alternativa limitada é recusar centavos explicitamente. Preferível suportar centavos sem mudar a redação fixa.

### 3. CPF inválido, data impossível e caracteres de controle aceitos

**Reprodução:** segunda testemunha com CPF `123` gera Word real. O validador aceita `2026-02-31` e texto com controle XML `U+0001`.

**Causa:** CPF validado apenas como texto; `Date.parse` normaliza dias impossíveis; texto não restringe caracteres ilegais para XML.

**Ajuste proposto:** validação compartilhada entre formulário e servidor, dígitos verificadores para CPFs, data civil conferida por ida e volta e rejeição de controles proibidos. Apresentar erros por campo antes de gerar. Adicionar regressões que falhem com os exemplos acima.

## Ajustes de arquitetura — prioridade média

### 4. Cadastro incompleto pode gerar contrato incompleto

O exemplo real exporta qualificação sem estado civil, profissão e endereço. O botão verifica apenas se o texto total não está vazio; não valida cada dado necessário. Isso não prova que os dados de proprietários reais estejam incompletos, mas comprova ausência de barreira no gerador.

**Proposta:** preparar um objeto estruturado por pessoa e imóvel, com pendências explícitas; montar a qualificação por adaptador próprio. Decidir obrigatoriedade por tipo de pessoa. Hoje coproprietários recebem contato e endereço do titular no texto montado, embora o cadastro já disponibilize email/telefone por pessoa; revisar esse mapeamento antes de certificar casos multi-proprietário.

### 5. Conferência perde alterações ao fechar

Fechar e reabrir descarta alterações sem confirmação; recarregar também perde o preparo. Hoje isso é um exportador temporário, não um contrato registrado.

**Proposta:** primeiro incluir aviso de alterações não salvas. Se houver necessidade de histórico, criar rascunho persistido com versão dos dados, hash da minuta e documento associado; não confundir download com publicação, assinatura ou aceite das condições.

### 6. Modelo e substituições dependem de índices e frases fixas

A proteção por hash e allowlist é correta e deve permanecer. Entretanto, o mapeamento do imóvel só preserva a distribuição semântica de formatação para uma frase específica com apartamento/torre. Formas diferentes usam substituição integral do parágrafo; as propriedades permanecem, mas a atribuição de negrito a novos dados não está certificada para todos os formatos.

**Proposta:** extrair preparação de campos, validação e substituição em módulos próprios; mapas versionados e revisão explícita para cada nova minuta. Cobrir ausência de torre, múltiplos titulares e descrição longa antes de oferecer certificação ampla.

## Ajustes visuais

- Separar visualmente Contratantes, Imóvel, Condições e Assinatura; hoje os campos são uma lista longa com pouco contexto de conferência.
- Manter cabeçalho e ações acessíveis durante rolagem em celular; as ações finais ficam fora da primeira tela.
- Mostrar pendências específicas junto aos campos; atualmente o usuário pode ver botão desativado ou mensagem geral sem saber o que corrigir.
- Aumentar a leitura dos textos longos ou apresentar resumo estruturado antes de editar; os dois campos de texto exigem rolagem interna no celular.
- Evitar que notificações empilhadas cubram dados e título, como observado após gerações repetidas.
- O menu Contratos não oferece a geração atual: ela fica na ficha → Comercial. Criar acesso contextual que leve à ficha correta, sem duplicar o processo.
- Substituir seleção e checkbox nativos pelos controles já usados no restante do Admin, preservando acessibilidade.
- Oferecer etapa clara de conferência do documento antes da entrega; prévia paginada exige conversão compatível com o Word, não reconstrução da minuta em HTML.

## Limites e verificações ainda necessárias

- Não há Microsoft Word neste ambiente. O conversor disponível adiciona página final vazia até ao original; textos de tamanhos diferentes mudam as quebras. Paginação exata no Word permanece não certificada.
- Permissão de conta autenticada sem papel autorizado foi revisada no código, mas não testada com identidade real desse perfil. Bloqueio sem sessão e de ficha inexistente foi exercitado.
- Falhas de rede, troca de identidade, fechamento/reabertura durante requisição e dois operadores editando o mesmo cadastro merecem suíte específica após corrigir a revisão de geração.
- Os 50 casos adicionais verificam integridade de partes e remoção de dados antigos, não cinquenta comparações visuais no Word.

## Ordem recomendada

1. Corrigir consistência do preparo, centavos e validações.
2. Validar dados estruturados e múltiplos contratantes.
3. Melhorar conferência e navegação do formulário.
4. Só então validar documento preenchido no Word e decidir histórico/prévia/assinatura.

As mudanças propostas ainda **não haviam sido implementadas na data desta auditoria inicial**; os resultados posteriores seguem abaixo.

## Atualização após etapas 1–4 — 11/11/2026

- Corrigidos: inconsistência durante preparo, centavos por extenso, CPFs, datas civis, controles XML, qualificação estruturada por pessoa, contatos próprios, descarte sem aviso e organização da conferência.
- 55 testes passaram em seis arquivos. Novos casos cobrem múltiplas pessoas, empresa representada, caracteres especiais, descrição longa e imóvel sem torre; estrutura e partes fixas da minuta preservadas.
- Fluxo autenticado e download real conferidos. Falha de conexão não entrega documento e permite tentar novamente; edição/fechamento/Escape bloqueados durante preparo; sem sessão ou ficha válida não há documento.
- Ajuste adicional reproduzido e corrigido: aviso de rede em inglês sobrepunha o título no celular; agora há mensagem em português dentro da janela, sem encobrir a conferência.
- Quatro tamanhos de tela conferidos, incluindo 320 px, sem transbordamento ou exceções. Documento baixado com XML válido, cláusulas gerais e partes fixas intactas.
- Não afirmar funcionamento perfeito: paginação no Microsoft Word exige inspeção no Word; ausência de papel autorizado, troca de identidade e concorrência entre operadores não foram exercitadas com identidades reais nesta etapa. Histórico persistido, PDF e assinatura não fazem parte desta entrega.