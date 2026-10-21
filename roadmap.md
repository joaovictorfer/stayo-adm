# Roadmap
- [ ] Cobranças STAYO — projeto por fases: central administrativa, criação avulsa/vinculada, vínculo posterior, página de pagamento baseada no PDF, Pix integral/cartão +5% via Pagar.me; nota fiscal fora da etapa atual. Aguardando aprovação do plano antes de implementação.
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
