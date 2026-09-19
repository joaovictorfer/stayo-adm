# Auditoria final — Implantação + Portal do Proprietário

**Data:** 19/09/2026  
**Escopo:** Fases anteriores do Stayo Admin e Portal do Proprietário  
**Método:** inspeção de código, migrations e políticas; execução autenticada em Chromium desktop (1280×1800) e mobile (390×1800); fluxo real de cadastro rápido; ciclo real de criação, cópia, abertura e revogação de link; suíte automatizada completa.

## Resumo executivo

**Veredito: aprovado com restrições críticas antes de uso operacional multiusuário.**

A experiência visual está consistente, clara e responsiva. O Portal usa link opaco, respeita revogação e apresenta somente uma projeção pública dos dados. Cadastro rápido, Portal progressivo, onboarding retomável, CEP, PIX, banco, prefill e separação entre progresso e prontidão existem.

Entretanto, a camada `CoreApiClient` em uso continua mock/localStorage. Implantações criadas não são compartilhadas entre navegadores/dispositivos e podem ficar desacopladas dos proprietários reais gravados no backend. Também foram encontrados: ações decorativas na topbar, falha ao colar telefone com `+55`, UUIDs dominando o resumo do workspace, prontidão “Apta” sem checklist e documentos do Portal ainda como placeholder.

## Evidências executadas

- **55/55 testes automatizados passaram** em 12 arquivos.
- Dashboard, Implantação e Proprietários abriram autenticados em desktop e mobile sem erros de console.
- Nenhuma das telas verificadas apresentou rolagem horizontal geral.
- Cadastro rápido concluído em **1,66 s** no teste automatizado, após preenchimento dos campos mínimos.
- Duplicidade por telefone nacional foi detectada e exigiu escolha explícita.
- Link do Portal foi criado, copiado e aberto com token longo/opaco.
- Após revogação, o mesmo link retornou **“Acesso indisponível”**.
- A URL histórica informada para a implantação não abriu na sessão de teste, pois a implementação usa localStorage e o registro não estava naquele navegador.

## Matriz dos 24 critérios

| # | Critério | Resultado | Evidência / observação |
|---|---|---|---|
| 1 | Todos os botões funcionam | **FALHA** | Busca global e sino da topbar não possuem ação. “Mais ações” do proprietário oferece somente “Copiar nome”. |
| 2 | Não há botões decorativos | **FALHA** | Busca `⌘K` e notificações são visuais sem comportamento (`AdminShell`). |
| 3 | Portal no topo da implantação funciona | **PASS** | Botão “Portal” abriu o painel de gestão no workspace criado durante o teste. |
| 4 | Gerar link funciona | **PASS** | Criou token opaco e retornou URL pública. |
| 5 | Abrir portal funciona | **PASS** | Portal abriu e mostrou o modo “Em implantação”. |
| 6 | Copiar link funciona | **PASS** | Clipboard recebeu a mesma URL pública; depende da permissão do navegador e não há fallback visual de erro. |
| 7 | Revogar funciona | **PASS** | Após revogar e atualizar, o link mostrou “Acesso indisponível”. |
| 8 | Cadastro rápido é rápido | **PASS** | Duas etapas, campos mínimos e conclusão automatizada em 1,66 s. |
| 9 | Cadastro completo está no lugar correto | **PASS** | Fica em “Meus dados” dentro do mesmo Portal, não no cadastro rápido. |
| 10 | CEP funciona | **PASS/PARCIAL** | ViaCEP está isolado, preenche endereço e possui fallback manual. Não houve teste online completo com token válido sem alterar dados pessoais reais; testes e inspeção cobrem validação/falha. |
| 11 | Telefone possui máscara e normalização | **FALHA PARCIAL** | Formato nacional funciona e persiste sem pontuação. Colar `+55 54...` no campo mascarado virou `(55) 54987-6543` e foi rejeitado. |
| 12 | PIX possui tipo | **PASS** | CPF, CNPJ, telefone, e-mail e chave aleatória estão disponíveis. |
| 13 | Banco é informado | **PASS** | Campo pesquisável e obrigatório antes do envio. |
| 14 | Prefill funciona | **PASS em código / PARCIAL em execução** | Nome, telefone e e-mail vêm do snapshot; PIX pode usar CPF/CNPJ/telefone/e-mail informado. Não foi submetido dado bancário real no teste. |
| 15 | Mobile não quebra | **PASS com ressalvas** | Sem overflow em 390 px; drawer e filtros cabem. A listagem mantém todos os filtros abertos e fica densa. |
| 16 | Desktop sem scroll horizontal indevido | **PASS** | Verificado em 1280 px nas telas principais e no Portal. |
| 17 | Contraste correto | **PASS visual** | Fundo claro, navy, texto escuro e estados sem falhas aparentes nas capturas. Recomenda-se scanner WCAG automatizado posterior. |
| 18 | Logo oficial aparece corretamente | **PASS/PARCIAL** | Sidebar e Portal usam a logo oficial. A tela de login observada ainda mostrou o monograma “S”. |
| 19 | Nenhuma informação privada aparece no Portal | **PASS com risco operacional** | Snapshot é explícito; não inclui notas, logs, token, Wi-Fi, hóspedes, prestadores ou custos internos. Checklist depende de `ownerVisible` estar corretamente configurado. |
| 20 | Nenhum UUID domina a interface | **FALHA** | O resumo do workspace mostra ID da implantação, responsável, Core Property e Core Owner como campos principais. |
| 21 | Progressão e prontidão são conceitos diferentes | **PASS** | Cálculos e cartões separados; texto explicita a diferença. |
| 22 | Evolução para imóvel ativo sem duplicidade | **PASS em contrato / NÃO TESTÁVEL em produção** | Conversão é idempotente quando IDs Core existem, mas está desabilitada porque escrita no Core real ainda não existe. |
| 23 | Portal acompanha mudança de ciclo | **PASS** | Estado é recalculado no acesso; gates diferenciam implantação, pronto e ativo. Testes unitários cobrem transição e histórico. |
| 24 | Sem regressão em integrações | **PASS/PARCIAL** | 55 testes passaram e ViaCEP/Cloud não mostraram erro. A integração Core permanece mock, portanto não há integração real para validar ponta a ponta. |

## Itens validados por área

### Stayo Admin

#### Design System, sidebar e topbar
- **PASS:** fundo claro, superfícies brancas, navy institucional, champagne discreto e estados semânticos.
- **PASS:** sidebar desktop agrupada, item ativo claro e drawer mobile.
- **PASS:** logo oficial na sidebar.
- **PASS:** menu de conta e logout possuem ação real.
- **FALHA:** busca global não pesquisa nem navega.
- **FALHA:** sino de notificações não abre conteúdo nem comunica indisponibilidade.
- **RISCO:** papéis configurados na navegação não são usados para ocultar itens. A segurança efetiva depende das políticas do backend.

#### Dashboard
- **PASS:** hierarquia, estados vazios honestos, CTA “Ver operação” e ausência de overflow.
- **PARCIAL:** métricas dependem da camada Core mock e não representam uma operação compartilhada real.
- **PASS:** vazio não é apresentado como dado inventado.

#### Listagem de implantações
- **PASS:** status, responsável, período e prontidão combinam entre si; lista/funil usam o mesmo resultado.
- **PASS:** loading, erro, vazio e retry estão padronizados.
- **FALHA/PENDENTE DA FASE 8:** não existe busca global por proprietário, telefone, IMP, empreendimento, unidade e cidade.
- **FALHA/PENDENTE DA FASE 8:** não existem filtros de pendências e etapa, nem agrupamento “Mais filtros” ou ação “Limpar filtros”.
- **PARCIAL:** a lista usa localStorage; um registro existente no backend pode aparecer como inexistente no navegador.

#### Cadastro rápido
- **PASS:** duas etapas e somente campos essenciais.
- **PASS:** responsável atual é pré-selecionado quando disponível.
- **PASS:** condomínio aceita existente ou provisório e preenche cidade quando encontra correspondência.
- **PASS:** duplicidade por telefone nacional oferece “Vincular” ou “Continuar com novo cadastro”; não faz merge automático.
- **FALHA:** texto ainda diz “Encontramos um proprietário...” e não oferece “Ver cadastro”, conforme previsto na Fase 8.
- **FALHA:** telefone colado com `+55` não é tratado corretamente pelo campo controlado.
- **RISCO ALTO:** proprietário é salvo no backend real, enquanto implantação é salva no mock. Uma falha intermediária pode deixar proprietário órfão e não há rollback.

#### Workspace da implantação
- **PASS:** cabeçalho contextual, ações Portal/Compartilhar/Documento e status.
- **PASS:** progresso e prontidão separados.
- **PASS:** PDF do resumo e navegação por abas existem.
- **FALHA:** sem checklist gerado, prontidão aparece “Apta” com 0/0 itens. O estado deveria ser “Não avaliada” ou equivalente, não uma aprovação operacional.
- **FALHA:** resumo ainda é uma grade extensa de campos, com UUIDs visíveis e responsável exibido como UUID.
- **FALHA:** abas previstas “Visão geral”, “Documentos” e “Histórico” não seguem integralmente a organização solicitada; documentos/histórico aparecem fora ou incompletos.
- **PARCIAL:** não há ação “Mais ações” no header; mobile mostra Portal/Documento, mas omite Compartilhar.
- **PARCIAL:** link “Compartilhar” copia a URL interna do Admin, não o link público do Portal.
- **PARCIAL:** URL de implantação criada em localStorage deixa de funcionar em outro contexto/navegador.

#### Ficha do proprietário
- **PASS:** workspace com oito abas, indicadores compactos, resumo curto, PIX mascarado e gates visuais.
- **PASS:** “Enviar mensagem” usa WhatsApp/e-mail e fica indisponível sem contato.
- **PASS:** documentos e dados bancários têm restrições distintas de papel no backend.
- **FALHA/PENDENTE DA FASE 8:** edição administrativa de telefone, e-mail e CPF/CNPJ não aplica máscara, checksum ou deduplicação.
- **FALHA:** telefone é exibido cru na listagem e no resumo.
- **PARCIAL:** “Mais ações” contém apenas uma ação; o rótulo visual sugere um menu mais completo.

### Portal do Proprietário

#### Acesso e segurança
- **PASS:** token gerado com 256 bits, não previsível e sem UUID sequencial na URL.
- **PASS:** apenas hash é persistido; token puro fica somente na sessão administrativa.
- **PASS:** criar, copiar, compartilhar, abrir, gerar novo e revogar estão implementados.
- **PASS:** expiração/revogação são revalidadas no servidor em cada acesso.
- **PASS:** erro público é genérico e não permite distinguir link expirado, revogado ou inexistente.
- **RISCO:** copiar link não apresenta fallback quando Clipboard API é negada.

#### Identidade e navegação
- **PASS:** logo oficial, fundo claro, navy e champagne discreto.
- **PASS:** navegação progressiva libera módulos por estágio.
- **PASS:** desktop e mobile sem overflow geral.
- **PASS:** estágio ativo exige status `ativo` e `corePropertyId`, impedindo liberação prematura.

#### Implantação e cadastro
- **PASS:** visão geral apresenta etapa, progresso, previsão, tarefas públicas e atualizações.
- **PASS:** cadastro fica em “Meus dados”, tem cinco etapas e retomada por rascunho.
- **PASS:** PF/PJ, telefone, CEP, endereço, banco, titular, tipo de PIX, chave e revisão existem.
- **PASS:** prefill usa dados do snapshot e sugestões explícitas, permitindo substituir.
- **PASS:** falha do CEP mantém todos os campos editáveis.
- **PARCIAL:** CPF/CNPJ são validados apenas por quantidade de dígitos; não há verificação dos dígitos verificadores.
- **PARCIAL:** o servidor aceita telefone entre 10 e 13 dígitos no onboarding, mais permissivo que a validação brasileira usada no Admin.

#### Dados bancários e documentos
- **PASS:** banco não é inferido pela chave PIX.
- **PASS:** tipo de PIX é obrigatório e conta principal está modelada.
- **PASS:** dados bancários não são enviados a logs de frontend.
- **PASS:** políticas restringem perfil e conta de repasse a papéis internos diferentes.
- **NÃO IMPLEMENTADO:** aba Documentos do Portal é um empty state; não existe listagem/download de arquivos liberados ao proprietário.

#### Transição para imóvel ativo
- **PASS:** mesma URL/produto evolui entre implantação, pronto e ativo.
- **PASS:** histórico do convite e snapshot é preservado.
- **PASS:** módulos ativos mostram vazios honestos sem inventar valores.
- **NÃO TESTÁVEL PONTA A PONTA:** conversão real está desligada e o Core ainda não aceita escrita.

## Cenários adicionais

| Cenário | Resultado |
|---|---|
| Campos vazios | **PASS/PARCIAL:** estados honestos; prontidão 0/0 é incorreta. |
| Loading | **PASS:** skeletons em Admin e Portal. |
| Erro | **PASS:** retry no Admin e mensagem pública no Portal. |
| Sem conexão | **PARCIAL:** CEP possui fallback; demais telas não têm teste de perda de conexão automatizado. |
| Duplicidade | **PASS por telefone nacional / FALHA para +55, e-mail e CPF/CNPJ.** |
| Refresh | **PASS no Portal:** resolve novamente pelo token. **PARCIAL no Admin:** dados Core persistem apenas no navegador. |
| Link expirado/revogado | **PASS:** RPCs validam os dois; revogado foi testado ao vivo. |
| Usuário sem permissão | **PASS no backend / NÃO TESTADO ao vivo:** políticas existem, mas não havia sessão de papel restrito disponível. |
| Implantação sem imóvel identificado | **PASS:** usa fallback “Imóvel ainda sem identificação”. |
| Proprietário incompleto | **PASS:** indicadores mostram cadastro pendente e Portal permite completar dados. |

## Bugs encontrados

### Críticos

1. **Implantações e demais domínios Core usam mock/localStorage**, não backend compartilhado.
2. **Criação mistura proprietário real e implantação mock sem transação/rollback.**
3. **Prontidão “Apta” com checklist vazio**, podendo comunicar liberação operacional sem avaliação.

### Altos

4. **Telefone com `+55` falha no input mascarado** e impede encontrar o mesmo proprietário.
5. **UUIDs dominam o resumo da implantação**, inclusive responsável exibido como ID técnico.
6. **Busca e notificações da topbar são decorativas.**
7. **Documentos do Portal não estão implementados**, apenas representados por estado vazio.

### Médios

8. Deduplicação do cadastro rápido cobre somente telefone; ficha administrativa não deduplica por e-mail ou CPF/CNPJ.
9. CPF/CNPJ têm máscara no Portal, mas validação apenas por tamanho, sem checksum.
10. Telefone aparece sem máscara na listagem/ficha do proprietário.
11. Filtros e busca previstos na Fase 8 não foram implementados.
12. “Compartilhar” do workspace copia a URL interna, não o acesso público do proprietário.
13. Ações mobile do workspace omitem Compartilhar.
14. Busca do CEP expõe o IP do usuário ao provedor ViaCEP, comportamento comum, mas deve constar na avaliação de terceiros.

### Baixos

15. “Mais ações” do proprietário possui somente uma opção.
16. Clipboard não possui fallback nem erro visível.
17. Login ainda exibe monograma “S” em vez da logo oficial observada no restante do sistema.

## Bugs corrigidos durante esta auditoria

**Nenhum.** Conforme solicitado, esta fase foi somente de auditoria e relatório. Nenhum arquivo do aplicativo, regra, integração ou banco foi alterado.

## Pendências

1. Implementar e validar a Fase 8, que permanece planejada, mas não executada.
2. Substituir a camada Core mock por integração real antes de uso multiusuário.
3. Definir estado de prontidão para checklist não iniciado.
4. Completar Documentos do Portal com liberação explícita por arquivo.
5. Testar com sessão de operações, comercial, financeiro e viewer.
6. Executar transição real implantação → ativo quando o endpoint Core existir.
7. Automatizar os fluxos de UI hoje cobertos apenas manualmente.

## Riscos

- **Perda/inconsistência de dados:** localStorage varia por navegador e pode ser apagado.
- **Registros órfãos:** proprietário real pode ser criado sem implantação correspondente.
- **Falsa prontidão:** 0/0 aparece como “Apta”.
- **Expectativa incorreta:** topbar aparenta busca/notificações funcionais.
- **Privacidade operacional:** `ownerVisible` depende de configuração correta dos templates; um item marcado incorretamente será exposto no Portal.
- **Acesso por papel:** esconder itens de menu não substitui políticas; testes reais com papéis restritos ainda faltam.
- **Transição não comprovada:** lifecycle está correto em código, mas conversão real permanece indisponível.

## Débitos técnicos

- Fonte de dados híbrida entre backend e mock.
- Ausência de testes de componentes e E2E para botões principais.
- Ausência de teste automatizado de responsividade e contraste.
- Ausência de checksum CPF/CNPJ.
- Validação de telefone divergente entre Admin e onboarding público.
- Uso relevante de valores visuais hardcoded no Portal em vez de tokens semânticos globais.
- Arquitetura de documentos públicos ainda não conectada ao storage privado.
- Cobertura incompleta de estados offline e falhas de clipboard/compartilhamento.

## Melhorias futuras — não iniciadas

1. Conectar o Core real mantendo a interface `CoreApiClient`.
2. Executar a Fase 8: busca global de implantação, filtros avançados, normalização integral e deduplicação multichave.
3. Criar testes E2E dos fluxos Portal, onboarding PF/PJ, CEP, todos os tipos de PIX, retomada e permissões.
4. Substituir ações decorativas por funcionalidades reais ou removê-las até existirem.
5. Reorganizar detalhes técnicos do workspace em área recolhível e resolver nomes de responsáveis.
6. Criar estado “Não avaliada” para prontidão sem checklist.
7. Implementar documentos liberados individualmente ao proprietário.
8. Executar auditoria automatizada WCAG e regressão visual por viewport.

## Arquivos e áreas principais auditados

- `src/config/theme.css`, `src/styles.css`
- `src/components/layout/AdminShell.tsx`
- `src/config/navigation.ts`
- `src/routes/index.tsx`
- `src/routes/implantacao.index.tsx`
- `src/routes/implantacao.$id.tsx`
- `src/components/implantacao/WorkspaceHeader.tsx`
- `src/components/implantacao/OwnerPortalAccess.tsx`
- `src/components/implantacao/PropertyPanel.tsx`
- `src/components/portal/OwnerOnboardingFlow.tsx`
- `src/components/owners/OwnerWorkspace.tsx`
- `src/routes/proprietarios.index.tsx`
- `src/routes/portal.implantacao.$token.tsx`
- `src/lib/api/core-client.ts`, `src/lib/api/admin-client.ts`, `src/lib/api/queries.ts`
- `src/lib/phone.ts`, `src/lib/services/postal-code.ts`
- `src/lib/implementation-status.ts`, `src/lib/owner-portal-lifecycle.ts`
- migrations de convite, onboarding, autenticação do proprietário e lifecycle progressivo

## Conclusão

O Portal está conceitualmente bem protegido e o fluxo de acesso funciona de ponta a ponta. O Design System também está estável e responsivo. A principal barreira para considerar o módulo Implantação pronto para operação é estrutural: sua fonte de dados ainda é local/mock e está misturada com proprietários persistidos no backend. Antes de novas funcionalidades, recomenda-se corrigir essa fronteira, a falsa prontidão 0/0, o telefone `+55`, os UUIDs visíveis e as ações decorativas.
