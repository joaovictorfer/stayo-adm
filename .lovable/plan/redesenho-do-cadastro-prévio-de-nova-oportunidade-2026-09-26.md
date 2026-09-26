# Redesenho do cadastro prévio de Nova oportunidade

## Antes de começar (conflito com a especificação)
A especificação pede edição só pelo GitHub, PR sem merge e nenhuma migration em produção sem autorização. Aqui as mudanças entram direto no projeto (e sincronizam com o GitHub), e há um único banco para prévia e publicado. Ao aprovar este plano, você autoriza o trabalho por aqui e a migration descrita abaixo. Se preferir o fluxo por PR, rejeite o plano e eu entrego só o diagnóstico.

## Estado confirmado
- "Nova oportunidade" abre um painel com três caminhos (cadastrar, agendar reunião, convidar). Todos criam um rascunho **vazio** (`admin_create_draft_opportunity` aceita título vazio e não pede nome nem telefone).
- Depois disso, a ficha abre um formulário de 8 etapas com barra horizontal e revisão em lista com "Falta".
- Nome e telefone são salvos à parte (`admin_save_opportunity_contact`); os demais campos usam salvamento automático com proteção de conflito.

## O que muda
1. **Uma única ação "+ Nova oportunidade"**, que abre a jornada guiada em tela própria (tela cheia no celular, painel largo no desktop), sem painel de três caminhos.
2. **Etapa 1 — Contato:** título, nome e telefone obrigatórios. A oportunidade só é criada quando os três estão válidos. Mostra aviso de contato já existente pelo telefone. Depois: "Criar ficha agora" ou "Continuar preenchendo".
3. **Etapa 2 — Imóvel:** perguntas curtas ("Fica em condomínio?" Sim/Não/Não sei → condomínio, torre, unidade; "Sabe o endereço?" Preencher/Depois), seletores rápidos para tipo, quartos e capacidade. Nada bloqueia o avanço.
4. **Etapa 3 — Proposta:** uma pergunta por tela com botões de escolha: taxa de administração, limpeza comercial, limpeza antes da operação, enxoval, assessoria, exclusividade, vigência, aviso prévio, uso próprio e cessão. Usa só os campos que já existem nas condições do contrato.
5. **Etapa 4 — Implantação:** mini-hub "O que você quer registrar agora?" com Enxoval, Itens do imóvel, Fornecedores, Itens faltantes e Observações. Cada um abre a experiência compacta já existente e volta ao hub.
6. **Etapa 5 — Revisão:** resumo por grupo ("✓ Bruna Haupenthal", "2 informações para completar depois"). Ações: "Publicar proposta e gerar link" (só quando a proposta pode ser publicada), "Criar ficha sem enviar" e "Continuar editando".
7. **Navegação enxuta:** "Etapa X de 5", barra de progresso discreta, Voltar/Continuar em rodapé fixo no celular, "Salvar e sair". Sem cards administrativos, prontidão ou histórico durante o cadastro.
8. **Salvamento automático** após a criação, com os indicadores "Salvando…", "Salvo" e "Não foi possível salvar · tentar novamente". O que foi digitado nunca é apagado.
9. **Retomada:** rascunhos existentes abrem na mesma jornada, na etapa em que pararam. Agendar reunião e gerar link passam a ser ações da ficha.

Fora do escopo: redesenho da ficha pós-criação, portal, imóveis, contratos, Core, WhatsApp, criação de imóvel operacional.

## Detalhes técnicos
- Nova migration incremental: `admin_create_draft_opportunity` passa a exigir título, nome e telefone válidos (mesma normalização de `admin_save_opportunity_contact`), cria ou vincula o proprietário prospect na mesma transação e mantém a idempotência por requestId e o lock de origem. O RPC `admin_create_opportunity`, que já existe, será avaliado primeiro para reaproveitamento.
- Novo `src/components/implantacao/opportunity-journey/` (shell, 5 etapas, hub, revisão), reaproveitando `useOpportunityAutosave`, `autosaveOpportunity`, `implementation_contract_conditions`, `PropertySuppliersPanel`, `MissingItemsTab`, enxoval e itens.
- `NewOpportunityDrawer` passa a abrir a jornada. Na ficha, `OpportunityWizard` é substituído pela jornada nos rascunhos (`?etapa=` mapeado para as 5 etapas).
- Testes: validação do mínimo comercial, mapeamento de etapas, resumo da revisão e idempotência. Verificação com Playwright em 375, 390, 430 e 1440 px, criação real e retomada.
