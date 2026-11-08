# Roadmap
- [x] Ficha F1: abas na nova ordem (Proprietários em 3º) e Resumo com 3 contadores separados (inventário, envios, bloqueios) e estados carregando/erro/tudo conferido.
- [x] Ficha F2: Proprietários com bloco por pessoa, selos Oficial/Enviado/Nota interna, "Falta" e divergências com decisão manual; Imóvel com composição e estacionamento editados só ali e cadastro x coleta ("Conferir na vistoria").
- [x] Ficha F3: aba Implantação resumida (sem resposta, faltas, compras) + "Abrir implantação completa ↗"; página /implantacao/$id/completa com Utensílios, Fornecedores e equipamentos, Enxoval e 6 filtros; abas Itens faltantes/Checklist removidas; números atualizam ao voltar à guia. Conferido em 1280/390.
- [x] Ficha F4: padrão STAYO copiado na ficha, exceções com "voltar ao padrão", "Salvar condições" com antes/depois. Quem paga a limpeza de implantação segue em aberto.
- [x] Ficha F5: salvar condições publica versão no mesmo link; valor após aceite exige reconfirmação, só texto herda aceite; aceite antigo recusado ("condições atualizadas"); links expiram naturalmente.
- [ ] Ficha F6: histórico consolidado.
- [ ] Ficha F7: vínculo STAYO APP (obrigatório antes de Ativo) — bloqueado pela homologação da API.
- [x] Fase 2A: contratos oficiais c5e2b1e0 copiados, consumidor/demonstrativo e CPF server-only fail-closed preparados; 68 testes passaram, build OK, relatório docs/api/PHASE-2A-CONSUMER-REPORT.md. Sem credenciais, migrations, conexão produtiva, importação, sincronização ou publicação.
- [ ] Fase 2A homologação futura: aguarda autorização específica, credencial temporária, finalidade local de CPF e sessão para validar interface autenticada; não emitir token nem conectar nesta fase.
- [x] Corrigir exclusão com links de cadastro/vistoria; erro reproduzido na IMP-00013 e mesma ação validada após correção. Regressão real passou para links, confirmação incorreta, anon, ativa e vínculos Core; histórico financeiro protegido.
- [x] Excluir pelo painel IMP-00013, IMP-00012, IMP-00011 e IMP-00006; remoção e ausência de links órfãos conferidas.
- [ ] IMP-00007: aguardando autorização para desvincular apenas a ficha de teste do imóvel operacional antes de excluir; não remover imóvel ou dados operacionais.
- [x] Pedido 20:09 — acesso Pagar.me destacado em Configurações e navegação autenticada até o campo conferida; 3 testes passaram, build OK; sem chave de teste enviada.
- [x] Configurações Pagar.me no app: formulário restrito, armazenamento cifrado, substituição/remoção e teste somente leitura; 3 testes e fluxo autenticado salvar/recarga/remoção com fixture descartável conferidos, produção rejeitada, build OK. Aguardando chave real de teste do usuário para validar Pagar.me; sem recebimentos reais.
- [ ] Novo pedido 19:40 — Cobranças Fase 3: QR Pix dinâmico e checkout cartão +5% server-side, exclusivamente sandbox; executar após preparação 10B.2, bloqueado pela conexão Pagar.me não concluída, sem inventar credencial.
- [x] Fase 10B.2 preparação segura: auditoria/matriz, transporte Central server-only, diagnóstico admin, correspondência UUID sem importação, checkpoints restritos e documentação; 46 testes passaram, build OK, navegador desktop/mobile pendente validado e cadastros preservados.
- [ ] Fase 10B.2 homologação: referência OpenAPI obtida na Fase 2A; aguarda correções documentais do provedor, autorização específica e credencial temporária. Aplicação e primeira conexão não homologadas. Nenhuma sincronização automática ou escrita produtiva.
- [x] Cobranças Fase 2: cadastro persistente, publicação de demonstrativo com token seguro, histórico, vínculo posterior, revogação/cancelamento e validação avulsa ponta a ponta; pagamento bloqueado sem Pagar.me. Cobrança fictícia COB-000001 mantida para consulta solicitada; 12 testes e fluxo real autenticado/mobile conferidos.
- [ ] Pedido adicional / Fase 3: vincular Pagar.me antes de gerar link pagável; conexão segura continua ausente. Link de consulta da cobrança fictícia disponível, sem transação ou serviço real. Capa do imóvel real aguarda adaptação da autorização ao novo token de cobrança; fallback oficial sem foto, nunca foto fictícia em documento real.
- [x] Cobranças STAYO — Fase 1: central e formulário avulso/vinculado, vínculo posterior, detalhe/histórico e prévia por método com logo/capa fictícia; 14 testes e navegação autenticada desktop/mobile conferidos, nenhum pagamento ou dado real alterado.
- [ ] Cobranças — Fase 3 solicitada novamente: verificar e conectar Pagar.me de teste antes de implementar checkout/webhooks. Nenhuma conexão disponível em 21/10/2026; pagamentos reais só após validação e autorização, nota fiscal futura.
- [ ] Fase 3 (calendário oficial read-only): grade mensal com navegação de período e troca de imóvel; estados visuais (disponível, reserva confirmada, bloqueio/manutenção, uso do proprietário) com legenda; estritamente read-only (sem bloqueios que afetem PMS/canais); loading ao trocar mês/imóvel, vazio e falha de sincronização com aviso amigável; responsivo.
- [x] Fase 2 (painel do proprietário): visão geral com receita/líquido/repasses, contexto do imóvel ativo (individual/consolidado), cards de ações prioritárias (bloqueio/uso próprio, calendário, demonstrativos, suporte), próximas movimentações/avisos; estados completos (skeleton, vazio, erro, permissão negada); responsivo; dados sensíveis mascarados por papel.
- [x] Fase 1 (portal multi-imóvel): recuperação de senha sem enumeração de e-mails (/portal/recuperar + /portal/redefinir-senha), papéis titular/coproprietário (com cota)/representante legal em owner_portal_accounts, permissões por papel (representante não vê financeiro, dados bancários nem CPF completo e não edita imóvel), selo de papel no cabeçalho e seletor de imóveis já existente mantido.
- [x] Corrigir ambientes duplicados e resumo de suítes: identidade canônica por ambiente, banheiro privativo vinculado ao quarto e suíte derivada da composição; link e retomada conferidos, resposta do chuveiro preservada e lida no painel, resumo mostrou 1 suíte. 14 testes passaram; fichas e contatos de QA removidos.
- [x] Fase 5 (cadastro/vistoria): fluxo real pelo link dedicado, retomada, fotos/comentários e leitura no painel conferidos; 193 testes passaram, ficha e foto de teste removidas. Validação com ressalvas: templates fragmentam ambientes da suíte e resumo do proprietário não informa suítes; relatório em docs/FIELD_REGISTRATION_PHASE5_VALIDATION.md, sem alteração funcional nesta etapa.
- [x] Fase 1 (visual cadastro/vistoria): contadores compactos `[-] [n] [+]` de ambientes na tela Imóvel e espaçamentos reduzidos; conferido no navegador com autosave persistido após recarregar.
- [x] Fase 2 (visual cadastro/vistoria): indicador de suíte por quarto na etapa Quartos e camas; suíte renomeia o quarto e seu banheiro conta no total do imóvel (banheiros sociais = total − suítes); conferido no navegador com persistência após recarregar e ficha de teste removida.
- [x] Fase 3 (visual cadastro/vistoria): cards de cama compactos em linha única, ilustrações redesenhadas (vista lateral com cabeceira, travesseiros e rodinhas na auxiliar), toque no card soma +1 instantâneo, steppers −/+ mantidos e autosave ativo; conferido no navegador com persistência e ficha de teste removida.
- [x] Fase 4 (visual cadastro/vistoria): cabeçalho da vistoria enxuto (nome + progresso em linha, logo menor, barra fina), botões de resposta e chips táteis compactos para tablet/celular, espaçamentos e rolagem reduzidos (imagem 16:10 no tablet, grade mais densa, rodapé fino); fotos, comentários e autosave intactos; conferido em 820px e 390px com resposta salva; dados de teste removidos.
- [x] Refinar visual do cadastro e vistoria dedicado: etapas visuais, seleções rápidas de ambientes e cards de camas; autosave e recuperação de camas conferidos, ficha de teste removida.
- [x] Colocar seletor de ambiente no topo da lista lateral da vistoria de implantação; troca de ambientes conferida no tablet e celular.
- [x] Cadastro e vistoria dedicados: link seguro, criação de ficha com nome/telefone, imóvel, ambientes/camas e inventário; autosave, retomada e validação celular/tablet conferidos.
- [x] Simplificar cadastro de item em janela sobre a lista, ambiente atual e detalhes opcionais; cadastro conferido no celular e tablet, registros de teste removidos.
- [x] Padronizar detalhes no celular e tablet: catálogo, xícaras, pratos e itens manuais conferidos; marca de item manual persistiu após recarregar e testes foram removidos.
- [x] Unificar linhas e subitens do inventário, adicionar item em cada ambiente e priorizar itens avulsos em Outros; inclusão e persistência conferidas na ficha real, registros de teste removidos.
- [x] Remover "Fornecedores e instalações" do fim da ficha de implantação (duplicava os itens já preenchidos no inventário por ambiente); imports mortos limpos, ficha conferida no navegador sem erros.
- [x] Eletrodomésticos unificados numa linha só (Micro-ondas, Forno convencional, Airfryer, Torradeira, Cafeteira de cápsulas, Cafeteira elétrica, Chaleira elétrica, Geladeira, Frigobar, Adega, Purificador): respostas existentes conferidas no navegador, espelhos do banco preservados, fotos em todos os itens e seletor de composição sem sobreposição no celular.
- [x] Agrupar Frigideira em Panelas e reunir instalações e móveis em Fornecedores; abertura dos grupos conferida na ficha real, sem alterar dados por ambiente.
- [x] Mostrar fotos nos filhos de todos os grupos, com prioridade às referências do PDF e imagens geradas para os itens faltantes; 21 fotos conferidas na ficha real sem alterar respostas.
- [x] Liberação de plataformas por imóvel na ficha: STAYO escolhe onde anunciar (ex.: só Airbnb), o que não for liberado aparece desativado para o proprietário e a escolha dele é podada; fluxo conferido no Admin e no Portal.
- [x] Corrigir consultas repetidas de sessão/perfil e recarregamentos desnecessários; medição autenticada: implantação 7,7s → 3,4s, retornos sem consultas repetidas; ficha e saída da conta conferidas.
- [x] Microinterações no menu, ações e painéis administrativos; navegação autenticada e movimento reduzido conferidos.
- [x] Recuperar referências do PDF em todas as linhas e completar imagens ausentes com IA.
- [x] Ar-condicionado, aquecimento e móveis abrem marca e instalador ao marcar Sim.
- [x] Unificar visualmente comodidades e instalações com as linhas do inventário; detalhes pelo menu, sem alterar banco.
- [x] Fase 05 Preparação
- [x] Fase 06 Seu acesso
- [x] Correção 03A: PATCH não sensível, Quartos canônicos, Unidade/Ambientes e testes unitários/visuais simulados.
- [ ] Correção 03A — autosave/reload reais, igualdade Admin/Portal e conflitos no banco: bloqueados por falta de fixture segura com permissões para proposals e UPDATE de implementation_projects.

## Aba Proprietário (auditoria)
- [x] Fase 1: card Jornada vertical na lateral + proteção contra tela de erro
- [x] Fase 2: ficha cadastral enxuta, dados pessoais recolhidos e sensíveis protegidos; leitura, cópia, exibição/ocultação e abertura da edição conferidas na ficha real no computador e celular.
- [x] Fase 3: links e convites direto na aba Proprietário; janelas separadas por capacidade, cópia do link ativo e mensagem, geração da apresentação e leitura pública conferidas, recuperação após recarregar e celular 390/360 sem sobreposição; dados sensíveis fora da janela de links.

## Mercado & Empório (novo)
- [ ] Abas: Pedidos ativos, Reposição por imóvel, Catálogo & preços; consumo por reserva (aguardando escopo)

## VF - Financeiro
- [x] Localizar VF - Financeiro e contrato existente: POST /api/public/stayo-expenses e GET /api/public/stayo-statements; autenticação servidor a servidor e despesas idempotentes.
- [x] Credencial registrada pelo formulário seguro; consulta mensal e adaptador de envio autenticados implementados, com esquema estrito e transmissão bloqueada por padrão. Três testes passaram.
- [ ] Consulta real bloqueada: VF publicado respondeu 401 à credencial salva; alinhar STAYO_WEBHOOK_SECRET nos dois serviços. Nenhuma despesa real enviada; ativação depende de autorização explícita.

## Endereço do proprietário
- [x] Endereço voltou a ser pedido no cadastro público (CEP com preenchimento automático, obrigatório) e a ficha administrativa ganhou a seção Endereço; testes e tipos OK.

## Relatório de repasse
- [x] Arquitetura: reservas (Airbnb automático × recebidas pela STAYO), despesas lançadas no dia, repasses feitos e balancete por mês (/financeiro/repasses); 6 testes.
- [ ] PDF do relatório para o proprietário (próxima etapa).
- [ ] Puxar proprietários e reservas do Guia STAYO: bloqueado até a homologação da conexão com o Guia.
