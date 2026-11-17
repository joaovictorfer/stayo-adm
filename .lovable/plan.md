# Transferência da área operacional para o Stayo Adm (em fases)

Fonte: pacote `stayo-operacional-transferencia-2026-11-17` (código de referência, 43 tabelas documentadas, regras). Os dados de calendário, serviços, responsáveis e histórico **não** serão importados; entram só configurações e regras.

## Fase 0 — Análise (sem alterar nada)
- Ler `INSTRUCOES-PARA-STAYO-ADM.md`, o mapa de relações e as definições de banco.
- Cruzar com o Stayo Adm atual: imóveis (UUID / code / property_code), condomínios, papéis de acesso e telas que já existem (agenda, histórico, inventário).
- Entregar um relatório curto: o que reaproveitar, o que conflita e o que é novo.

## Fase 1 — Base de dados e regras
- Novas tabelas em migrations versionadas, com permissões e acesso só para a equipe Admin.
- Importar apenas regras operacionais (global, condomínio, imóvel), checklists e listas de conferência, ligadas aos imóveis pelo UUID, sem disparar gatilhos de pagamento ou geração de serviços.

## Fase 2 — Agenda e Tarefas
- Agenda Dia / Semana / Por imóvel, filtros, check-in/check-out, cobertura e equipe.
- Tarefas: lista, atrasadas, criação/edição, prioridade, imóvel, horário, valor e orientação.

## Fase 3 — Execução de limpeza e vistoria
- Atribuir equipe, iniciar, checklist com foto/evidência, concluir, imóvel limpo.
- Escalas por prestador e "Meu Dia" com link próprio, criado do zero (sem reutilizar tokens da origem).

## Fase 4 — Custos e revisão
- Custos operacionais por imóvel e reembolsos, só leitura/registro interno; nenhuma escrita nos repasses ou no financeiro VF.

## Fase 5 — Homologação
- Testar ponta a ponta: criar → atribuir → iniciar → checklist → concluir → revisão.
- O sistema antigo continua funcionando; desligá-lo só depois da sua aprovação.

## Detalhes técnicos
- Visual atual (azul-marinho, Outfit/Figtree, StayoLogo), escritas via core-client, RLS por `has_admin_role`.
- Código do pacote é referência: adaptado, não copiado às cegas. Nenhum segredo da origem é reutilizado.
- Cada fase termina com testes e conferência no navegador antes da seguinte.
