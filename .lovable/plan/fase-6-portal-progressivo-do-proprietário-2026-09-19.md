# Fase 6 — Portal progressivo do proprietário

## Objetivo
Transformar o portal atual em uma experiência única, cuja navegação e conteúdo evoluem de implantação para transição operacional e imóvel ativo, preservando o mesmo acesso e o histórico existente.

## Implementação
- Definir três estados derivados do ciclo real: `implantação`, `pronto para operação` e `imóvel ativo`; a ativação exige vínculo com o imóvel oficial, não apenas texto de status.
- Ampliar o snapshot público seguro com vínculo oficial, datas e disponibilidade explícita dos módulos, sem incluir notas internas, hóspedes, prestadores, margens ou credenciais.
- Fazer a resolução do link refletir o status atual da implantação no banco, mantendo o token, o onboarding, a proposta, as atualizações e demais dados históricos.
- Reorganizar a mesma rota pública em um shell com menus progressivos:
  - Implantação: Visão geral, Minha implantação, Meus dados, Proposta e Documentos.
  - Transição: mesmos itens mais uma experiência de prontidão e próximos passos.
  - Ativo: Visão geral, Reservas, Calendário, Meu imóvel, Vistorias, Manutenções, Financeiro e Documentos.
- Criar estados vazios honestos para integrações oficiais ainda indisponíveis. Nenhum valor financeiro ou operacional será inventado.
- Preparar contratos de leitura segura para reservas, vistorias, manutenções e financeiro, projetando somente os campos permitidos.
- Documentar estados e gates do portal.

## Segurança e regras
- O URL público continuará não previsível e não mudará na transição.
- Menus ativos só serão liberados quando houver `corePropertyId`; status `ativo` sem conversão continuará na experiência de transição.
- Dados de hóspedes, documentos pessoais, selfies, conversas privadas, notas internas, prestadores e custos/margens não entram nos contratos públicos.
- O financeiro será apenas uma visão consumidora preparada para demonstrativos, repasses e despesas oficiais, sem duplicar cálculos.

## Validação
- Testes unitários da derivação implantação → transição → ativo e dos gates.
- Testes do portal em desktop e mobile, incluindo navegação, ausência de overflow e estados vazios.
- Teste de preservação do mesmo link e do histórico ao avançar de estágio.
