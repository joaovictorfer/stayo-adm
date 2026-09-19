# Fase 8 — Buscas, filtros e qualidade dos dados

## Objetivo
Melhorar busca, filtros, máscaras, autocomplete, validação e deduplicação em Implantação e Proprietários sem redesenhar as telas ou alterar o fluxo rápido de duas etapas.

## Implantação
- Adicionar busca única por proprietário, telefone, código `IMP-*`, empreendimento/condomínio, unidade e cidade, ignorando acentos, pontuação e o prefixo `+55` em telefones.
- Manter Status visível e mover Responsável, Período, Prontidão, Pendências e Etapa para “Mais filtros”.
- Trocar o filtro de responsável por uma seleção com nomes reais e incluir ação clara para remover todos os filtros.
- Derivar Pendências e Prontidão dos checklists já carregados; Etapa usa o ciclo de status existente, sem criar regra paralela.
- Aplicar os mesmos resultados filtrados à lista e ao funil.

## Cadastro rápido de implantação
- Preservar as duas etapas e os campos mínimos aprovados.
- Manter máscara brasileira, validar DDD e persistir telefone nacional normalizado.
- Evoluir o alerta para “Possível proprietário existente”, com “Ver cadastro”, “Vincular” e “Criar novo mesmo assim”.
- No fluxo rápido, detectar correspondência por telefone; e-mail e CPF/CNPJ serão tratados no cadastro completo, pois esses campos não pertencem à ligação rápida.
- Tornar o autocomplete de condomínio pesquisável e acessível, preenchendo cidade e dados compartilháveis existentes sem impedir informação provisória.
- Registrar em auditoria as decisões de vincular ou criar apesar da correspondência, sem gravar telefone, e-mail ou documento no log.

## Proprietários e qualidade dos dados
- Buscar proprietários por nome, telefone em qualquer formato, e-mail e CPF/CNPJ em qualquer formato.
- Aplicar máscara brasileira à exibição/edição de telefone e máscaras de CPF/CNPJ no cadastro completo.
- Normalizar telefone, e-mail e CPF/CNPJ antes de salvar; validar telefone, e-mail e os dígitos verificadores de CPF/CNPJ.
- Antes de salvar alterações relevantes, detectar correspondências por telefone, e-mail ou CPF/CNPJ e exigir decisão explícita: ver, vincular quando o contexto permitir, ou continuar mesmo assim.
- Adicionar proteção no banco para manter os valores normalizados e rejeitar formatos inválidos, preservando a opção auditada de cadastros distintos quando a equipe confirmar.

## CEP e endereço
- Reutilizar o serviço de CEP já isolado, adicionar máscara e busca automática ao completar oito dígitos.
- Preservar fallback manual em qualquer falha.
- Normalizar CEP antes de persistir.

## Validação
- Testes unitários para telefone com/sem máscara e `+55`, CPF, CNPJ, normalização textual e combinação de filtros.
- Teste do CEP com sucesso, CEP inexistente e falha do serviço, confirmando fallback manual.
- Teste visual/funcional desktop e mobile: busca, filtros combinados, limpar filtros, autocomplete e decisões de duplicidade.
- Verificação de tipos, testes existentes e ausência de rolagem horizontal.
