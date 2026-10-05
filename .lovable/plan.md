# Inventário do proprietário — Modo Visual

## Auditoria inicial e bloqueios

- A tela atual é `/portal/inventario/$id`, com sessão de proprietário e vínculo verificado por `owner_can_access_implementation`. Não usa token de apresentação para escrita.
- O inventário guiado usa `implementation_guide_items`. `implementation_items` é checklist; `implementation_supply_items` mantém quantidades/faltantes. Não trocar essas responsabilidades nem criar inventário paralelo.
- As respostas são propostas em `implementation_inventory_submissions`, vinculadas ao mesmo item e implantação, visíveis na revisão Admin. O item oficial muda apenas após decisão STAYO.
- A função de leitura autorizada entrega orientação (`tip`), mas não foto, descrição, classificação ou link de compra. As tabelas já possuem esses campos; o proprietário não tem leitura direta das tabelas nem acesso direto às imagens privadas.
- No banco acessível nesta auditoria, há 70 itens de inventário, nenhum com foto ou link cadastrado. Isso não comprova o conteúdo do novo banco configurado.
- A configuração local aponta ao novo projeto informado anteriormente, enquanto as ferramentas disponíveis consultam outra instância Lovable Cloud. Não é possível tratar essa auditoria como validação do banco configurado. Nenhuma configuração será alterada silenciosamente.
- O link aberto sem sessão redirecionou a `/portal/login`. Persistência autenticada, visibilidade Admin e isolamento A/B ainda não foram testados.
- Não há conexão GitHub disponível nas conexões consultadas; o remoto local é gerenciado por Lovable, não o repositório GitHub solicitado. Commit/PR no GitHub permanecem pendentes de acesso.

## Pré-requisitos para implementar com evidência

1. Reconciliar qual banco atende o aplicativo e obter leitura verificável dessa mesma instância, sem editar arquivos de configuração gerados manualmente.
2. Disponibilizar acesso ao GitHub `joaovictorfer/stayo-adm` para entregar a alteração e eventual migration pendente em PR, sem merge.
3. Confirmar um caminho autorizado para fornecer apenas os metadados e imagens de referência dos itens acessíveis ao proprietário. Se exigir alteração das funções do banco, preparar mudança incremental no repositório e **não aplicar**; aguardar autorização.

## Implementação após desbloqueio

- Reusar o link, os IDs dos itens e o fluxo de submissão/revisão existentes.
- Construir conferência sem formulário aparente, com logo oficial, ambiente, progresso e alternador Visual/Lista. Visual ativo; Lista indisponível nesta fase, sem criar outra tela.
- Reproduzir a referência: foto de catálogo com fallback neutro, indicação discreta, nome e orientação breve, pergunta, Não/Sim e ações secundárias.
- Usar a observação do proprietário apenas em drawer; manter detalhes opcionais fora da tela principal e preservar os dados já enviados ao corrigir uma resposta.
- Persistir imediatamente Sim/Não/N/A e observação; avançar somente após confirmação real da gravação e sem drawer aberto. Sem toast ou mensagens de sucesso.
- Preservar respostas no retorno/reload, apresentar somente falhas acionáveis, impedir comandos concorrentes e tratar término do ambiente/inventário.
- Manter conteúdo centralizado no desktop, sem sidebar Admin. Sem alterações na ficha, no Core ou nas publicações.

## Detalhes técnicos e segurança

- A leitura deve projetar exclusivamente campos autorizados e assinar somente a imagem de referência vinculada ao item autorizado. Nunca expor notas internas, dados bancários ou fotos reais como referência.
- Toda autorização deve ser validada no servidor/banco pela sessão e vínculo. Não ampliar SELECT das tabelas privadas para viabilizar a interface.
- Reusar `owner_inventory_submit` e a revisão existente. A resposta aparece como envio do proprietário na mesma implantação; não substituir a verdade revisada automaticamente.
- Avaliar concorrência na função existente: não há controle explícito de versão no comando observado. Não prometer proteção contra conflitos entre dispositivos sem suporte verificado.

## Validação e entrega

- Testar Sim, Não, N/A, observação, correção e reload com sessão real de proprietário na instância reconciliada.
- Confirmar a submissão visível no Admin da mesma implantação e o bloqueio de leitura/escrita cruzada A/B, inclusive ID de item de outra implantação.
- Verificar imagens/links reais quando disponíveis, fallback, ausência de link, falha de gravação, sem permissão e finais de ambiente/inventário.
- Capturar 360/390/430/1440; entregar screenshots 390px e desktop, arquivos alterados, reuso, diferenças justificadas e resultados, separando testes simulados de reais.
- Entregar commit e PR somente quando houver acesso verificável ao GitHub; não fazer merge, publicar ou avançar para Lista.

**Situação atual:** implementação bloqueada pela reconciliação do banco e pelo acesso GitHub. Nenhum código, schema, dado ou produção foi alterado nesta auditoria.