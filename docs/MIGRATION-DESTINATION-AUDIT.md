# Auditoria do destino externo — 21/11/2026

## Resultado

A migração não está certificada. O aplicativo atual ainda está conectado ao Lovable Cloud: a configuração pública instalada não coincide com o destino solicitado. Nenhuma configuração gerenciada foi sobrescrita e a chave privada exposta não foi usada nem armazenada.

## Testes executados

- Destino externo: HTTP 200 em `admin_profiles`, `implementation_projects` e `op_tasks` pela Data API, usando apenas chave pública e `select=id&limit=0`. Isso confirma endpoints e conexão, não registros, permissões autenticadas ou escritas.
- Configurações públicas de autenticação do destino: HTTP 200; email habilitado, cadastro habilitado e confirmação de email exigida. Site URL e lista de Redirect URLs não foram verificados.
- 13 testes existentes aprovados: `session.test.ts`, `complements.test.ts`, `complements.functions.test.ts` e `op-calendar.test.ts`.
- Navegador sem sessão no aplicativo atual, 1280×1800: `/login` abre; `/` e `/painel-migracao` redirecionam para `/login`. Zero erros de execução e sem transbordamento.
- Tela de login em 390×844: sem transbordamento; captura visual conferida.

Esses testes de navegador são do aplicativo atual, não do destino externo. Nenhum login, cadastro, logout ou fluxo CRUD no destino foi certificado. Não foram criados usuários ou registros de teste.

## Integridade

- 644 arquivos em `src`, 179 em `src/components`, 99 em `src/routes` e 24 migrations SQL encontrados.
- Não existe `supabase/functions` nesta árvore. Isso não implica ausência de funções já publicadas no destino.
- O ZIP completo do Admin citado no pedido não está disponível entre os anexos. O ZIP operacional de 17/11 não é uma cópia completa deste Admin.
- Sem o ZIP de origem, não é possível confirmar que todos os arquivos foram importados. A inspeção automatizada também atingiu seu limite agregado de análise textual; ela não representa varredura integral.
- Não houve git pull ou clone nesta auditoria. O código existente foi inspecionado no local.

## Conexão e arquitetura

O cliente público já lê variáveis de ambiente. Os manipuladores de servidor usam `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`, enquanto o navegador usa as correspondentes variáveis `VITE_`. Alterar somente as variáveis do navegador deixa leituras e escritas de servidor no banco anterior.

O Admin utiliza funções TanStack integradas ao aplicativo, além dos endpoints públicos em `/api/public/*`. Publicar Edge Functions no destino não substitui esses manipuladores. As variáveis e integrações precisam existir no ambiente que hospeda o aplicativo, não somente nas Edge Functions externas.

## Pendências concretas

1. Reenviar ZIP completo do Admin para comparação.
2. Revogar a chave privada exposta no provedor e registrar a substituta somente por um formulário seguro.
3. Configurar a conexão externa no ambiente de hospedagem do aplicativo, tanto no navegador como no servidor, sem trocar somente uma das partes. A conexão gerenciada atual não foi alterada.
4. Verificar login de usuário migrado, saída, autorização por papel e isolamento dos dados no destino após a configuração. Não pedir senhas em chat.
5. Verificar leituras e escritas representativas, arquivo privado, integrações Central STAYO/Pagar.me/VF, callbacks e agendamento de reservas no destino.
6. Validar as páginas com autenticação e identificadores reais; rotas parametrizadas e links privados não podem ser certificados com URLs fictícias.

Nenhuma migration, trigger, role, usuário ou função SQL foi criada ou reaplicada. Nenhuma Edge Function foi publicada. O sistema antigo permanece intacto. Não foram aplicadas otimizações especulativas nem executado build manual; testes de carregamento autenticado no destino continuam pendentes.
## Rotas de conteúdo detectadas (95)

Detecção no código não significa abertura certificada. Apenas as três rotas identificadas abaixo foram navegadas nesta auditoria, sem sessão. `/dashboard` não está declarada; o painel inicial é `/`. Endpoints HTTP não são páginas.

| Rota declarada | Verificação nesta auditoria |
|---|---|
| `/` | Redireciona para /login sem sessão; desktop |
| `/bi` | Não testada |
| `/cobranca/$token` | Não testada |
| `/condominios/` | Não testada |
| `/condominios/$id` | Não testada |
| `/configuracoes/` | Não testada |
| `/configuracoes/alertas` | Não testada |
| `/configuracoes/auditoria` | Não testada |
| `/configuracoes/automacoes` | Não testada |
| `/configuracoes/comercial` | Não testada |
| `/configuracoes/equipe` | Não testada |
| `/configuracoes/guias` | Não testada |
| `/configuracoes/integracoes` | Não testada |
| `/configuracoes/migracao` | Não testada |
| `/configuracoes/portal-staff` | Não testada |
| `/configuracoes/stayo-core` | Não testada |
| `/configuracoes/vistorias-prototipo` | Não testada |
| `/contratos/` | Não testada |
| `/contratos/$id` | Não testada |
| `/financeiro/` | Não testada |
| `/financeiro/$id` | Não testada |
| `/financeiro/cobrancas` | Não testada |
| `/financeiro/cobrancas-prototipo` | Não testada |
| `/financeiro/cobrancas/` | Não testada |
| `/financeiro/cobrancas/$id` | Não testada |
| `/financeiro/cobrancas/nova` | Não testada |
| `/financeiro/despesas-prototipo` | Não testada |
| `/financeiro/faturas-prototipo` | Não testada |
| `/financeiro/fechamentos-prototipo` | Não testada |
| `/financeiro/orcamentos-prototipo` | Não testada |
| `/financeiro/prototipo` | Não testada |
| `/financeiro/receber-prototipo` | Não testada |
| `/financeiro/repasses` | Não testada |
| `/financeiro/repasses-prototipo` | Não testada |
| `/guia/` | Não testada |
| `/guia/$id` | Não testada |
| `/guias-implantacao-prototipo` | Não testada |
| `/hospedes/` | Não testada |
| `/hospedes/$id` | Não testada |
| `/imoveis/` | Não testada |
| `/imoveis/$id` | Não testada |
| `/implantacao/` | Não testada |
| `/implantacao/$id` | Não testada |
| `/implantacao/$id_/completa` | Não testada |
| `/implantacao/fornecedores` | Não testada |
| `/implantacao/inventario` | Não testada |
| `/implantacao/propostas` | Não testada |
| `/implantacao/templates` | Não testada |
| `/login` | Abre sem sessão; desktop e celular |
| `/mensagens/` | Não testada |
| `/mensagens/$id` | Não testada |
| `/meu-dia/$token` | Não testada |
| `/operacao/` | Não testada |
| `/operacao/$id` | Não testada |
| `/operacao/agenda` | Não testada |
| `/operacao/agenda-prototipo` | Não testada |
| `/operacao/custos` | Não testada |
| `/operacao/equipe` | Não testada |
| `/operacao/limpeza` | Não testada |
| `/operacao/manutencao` | Não testada |
| `/operacao/prototipo` | Não testada |
| `/operacao/regras` | Não testada |
| `/operacao/tarefas` | Não testada |
| `/operacao/tarefas-prototipo` | Não testada |
| `/operacao/vistorias-links-prototipo` | Não testada |
| `/operacao/vistorias-prototipo` | Não testada |
| `/operacao/vistorias-revisao` | Não testada |
| `/painel-migracao` | Redireciona para /login sem sessão; desktop |
| `/portal/apresentacao/$token` | Não testada |
| `/portal/cadastro-vistoria/$token` | Não testada |
| `/portal/cadastro/$token` | Não testada |
| `/portal/cobranca-prototipo` | Não testada |
| `/portal/imovel/$token` | Não testada |
| `/portal/implantacao/$token` | Não testada |
| `/portal/inicio` | Não testada |
| `/portal/inventario/$id` | Não testada |
| `/portal/login` | Não testada |
| `/portal/previa/$id` | Não testada |
| `/portal/proposta/$token` | Não testada |
| `/portal/recuperar` | Não testada |
| `/portal/redefinir-senha` | Não testada |
| `/prestadores/` | Não testada |
| `/prestadores/$id` | Não testada |
| `/produtos/` | Não testada |
| `/produtos/$id` | Não testada |
| `/proprietario-prototipo` | Não testada |
| `/proprietarios/` | Não testada |
| `/proprietarios/$id` | Não testada |
| `/proprietarios/cadastros` | Não testada |
| `/reservas/` | Não testada |
| `/reservas/$id` | Não testada |
| `/vistoria-implantacao/$token` | Não testada |
| `/vistoria/prototipo/link` | Não testada |
| `/vistorias/` | Não testada |
| `/vistorias/$id` | Não testada |
