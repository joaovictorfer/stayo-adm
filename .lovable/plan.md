# Portal progressivo: implantação → operação

## Objetivo
Manter um único Portal do Proprietário e a mesma identidade visual durante todo o ciclo do imóvel. A experiência muda gradualmente conforme o status já existente da implantação, sem criar um segundo produto, uma nova URL ou novas regras de negócio.

## Experiência por fase

### 1. Implantação
- Preservar a navegação atual: Visão geral, Minha implantação, Meus dados, Proposta e Documentos.
- Manter progresso, marcos, pendências e orientações como foco principal.
- Indicar discretamente quais áreas operacionais serão liberadas depois, sem criar ações indisponíveis ou prometer dados inexistentes.

### 2. Pronto para operar
- Exibir um bloco de transição: “Seu imóvel está pronto para começar a receber hóspedes.”
- Mostrar data prevista/ativação quando disponível e os próximos passos já suportados pelos dados atuais.
- Introduzir a área operacional de forma gradual, diferenciando “em preparação”, “disponível” e “aguardando integração”.
- Preservar acesso a dados, proposta e documentos da implantação.

### 3. Imóvel ativo
- Quando o status for `ativo` e houver `corePropertyId`, trocar o foco da navegação para: Visão geral, Reservas, Calendário, Meu imóvel, Vistorias, Manutenções, Financeiro e Documentos.
- Manter Implantação acessível como histórico, sem perder proposta, marcos ou documentos anteriores.
- Criar um resumo operacional com ocupação, receita, diária média, próximas reservas e repasse previsto apenas quando houver dados oficiais; caso contrário, usar estados vazios honestos.

## Regras de disponibilidade
- Centralizar a derivação visual do ciclo em uma função reutilizável, baseada somente em `status` e `corePropertyId`.
- `implantação`: todos os estados anteriores a `pronto_para_operacao`.
- `transição`: `pronto_para_operacao`.
- `operação`: `ativo` com vínculo ao imóvel oficial.
- Não liberar Reservas, Calendário, Vistorias, Manutenções ou Financeiro antes do vínculo oficial.
- Não inventar valores, datas, reservas, repasses ou indicadores.
- Não expor dados de hóspedes, notas internas, custos internos, credenciais ou documentos não liberados.

## Implementação visual
- Adicionar um indicador de ciclo no topo do portal, integrado ao hero existente.
- Adaptar as abas ao ciclo atual com transição suave e sem ruptura visual.
- Criar uma visão de passagem para o estágio “Pronto para operar”.
- Reutilizar o Design System concierge existente, os componentes de loading e os estados vazios humanizados.
- Garantir navegação móvel legível e sem rolagem horizontal da página.

## Dados e validação
- Consumir exclusivamente os clientes e consultas existentes para imóveis, reservas, vistorias e financeiro.
- Filtrar os dados operacionais pelo `corePropertyId` vinculado.
- Quando uma fonte ainda não tiver dados reais, mostrar claramente que a área está pronta e será preenchida quando a operação começar.
- Adicionar testes unitários para a derivação do ciclo e dos módulos liberados.
- Validar build, testes e o portal em desktop e mobile.
