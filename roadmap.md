# Roadmap
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
