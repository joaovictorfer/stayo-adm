# Auditoria UX + arquitetura — Central de Implantação, Proprietário e Portal

Base: código atual do Stayo Admin (rotas em `src/routes`, contratos em `src/lib/api`,
banco com as migrações `0001`–`0015`). Classificação: MANTER, EVOLUIR, REFATORAR,
REMOVER, NÃO DUPLICAR, CRIAR.

## 1. Proprietários

| Peça | Estado | Classificação |
|---|---|---|
| `/proprietarios` (lista) | Busca por nome/código, estados de carregando/vazio/erro | MANTER |
| `/proprietarios/$id` (ficha, 791 linhas) | Dados, notas internas, tarefas, anexos | EVOLUIR para workspace com abas (Resumo, Imóveis, Implantações, Propostas, Contratos, Cobranças, Documentos, Histórico, Notas) |
| `owner_records`, `owner_notes`, `owner_tasks` | Tabelas com RLS | MANTER |
| Vários proprietários por implantação | Não existe (`implementation_projects.owner_id` é único) | CRIAR tabela de vínculo com papel e participação — NÃO DUPLICAR em `owner2_*` |

## 2. Implantação

| Peça | Estado | Classificação |
|---|---|---|
| `/implantacao` (lista + Nova implantação) | Filtro por status, cadastro rápido | EVOLUIR: cadastro em 4 etapas e escolha "do zero ou modelo" |
| `/implantacao/$id` (1089 linhas) | Stepper, checklist, proposta, condições, portal, cobranças, conversão Core | REFATORAR em seções/arquivos menores; cabeçalho de workspace já entregue |
| `computeProgress` / `computeReadiness` | Regra correta, progresso ≠ prontidão | MANTER sem alteração conceitual |
| Checklist (`implementation_items`) | Fases, categorias, obrigatório/bloqueador/visível | MANTER e usar como fonte das pendências |
| Modelos de implantação (clonar tudo) | Não existe (só templates de checklist) | CRIAR, aplicando como cópia (snapshot) |
| Imóvel estruturado (CEP, acessos, Wi‑Fi, quartos, banheiros) | Só campos planos em `implementation_projects` | CRIAR entidades filhas; MANTER os campos atuais |
| Enxoval e itens faltantes | Não existem | CRIAR |

## 3. Proposta e condições comerciais

| Peça | Estado | Classificação |
|---|---|---|
| `proposals` versionada + `ProposalTab` | Nova edição gera nova versão | MANTER versionamento; EVOLUIR campos |
| `commercial_terms` / `commercial_term_defaults` com `charge_type` | Já cobre percentual, fixo, por reserva, mensal, opcional, informativo | MANTER — NÃO DUPLICAR com um novo modelo de condições |
| Blocos de regras/observações com visibilidade por destino | Não existe | CRIAR |
| PDF da proposta (`src/lib/pdf/proposal-pdf.ts`) | Funciona | EVOLUIR e reutilizar para enxoval, faltantes e resumo |

## 4. Portal do proprietário

| Peça | Estado | Classificação |
|---|---|---|
| Token com hash, expiração e revogação (`owner_portal_invitations`) | Correto | MANTER |
| `/portal/implantacao/$token`, `/portal/proposta/$token`, `/portal/login`, `/portal/inicio` | Funcionais, visual de formulário | EVOLUIR para landing em seções, mobile-first |
| Pré-preenchimento com o que a Stayo já tem | Parcial | EVOLUIR |
| Confirmação campo a campo e fila de revisão no Admin | Não existe | CRIAR |
| Conteúdo institucional editável | Hardcoded | CRIAR blocos configuráveis com rascunho/publicado |

## 5. Plataforma

| Peça | Estado | Classificação |
|---|---|---|
| `AdminApiClient` / `CoreApiClient` | Único ponto de acesso a dados | MANTER e estender — nenhuma tela chama Supabase direto |
| Adapter local (localStorage) | Ainda usado como fallback | REMOVER gradualmente conforme as tabelas cobrirem o domínio |
| Auditoria (`audit_logs`) | Ativa | MANTER; nunca registrar senha, token, documento, selfie, Wi‑Fi ou fechadura |
| Autenticação e papéis (`admin_profiles`, `has_admin_role`) | Ativos com RLS | MANTER |
| Busca de CEP | Não existe | CRIAR `PostalCodeService` isolado, com preenchimento manual como alternativa |

## 6. Entregue nesta fase

- Cabeçalho de workspace na ficha da implantação: código, imóvel, proprietário, status,
  progresso, prontidão e pendências, com ações de portal, compartilhar e gerar documento.
- Bloco "Precisamos de atenção" derivado dos itens bloqueadores e obrigatórios em aberto.
- Este relatório, que orienta as fases seguintes (proprietários, imóvel, enxoval,
  modelos/proposta, portal, PDFs).
