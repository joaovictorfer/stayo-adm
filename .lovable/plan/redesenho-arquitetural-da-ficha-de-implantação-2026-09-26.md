# Redesenho arquitetural da ficha de implantação

## Antes de começar
Como na fase anterior, as mudanças entram direto no projeto (e sincronizam com o GitHub), sem PR separado. Nenhuma alteração de banco é necessária: é só reorganizar telas, reaproveitando os mesmos dados, regras e componentes.

## Estado atual confirmado
- A ficha é uma página única e longa: cabeçalho alto com 4 caixas (próxima ação, pendências, progresso, prontidão), uma barra de status e 7 abas horizontais (Resumo, Proprietário, Imóvel, Enxoval, Itens faltantes, Checklist, Proposta).
- O Resumo repete a proposta, as condições, as reuniões, o histórico, as cobranças iniciais e a conversão para o Core.
- A aba Proprietário junta vários cartões independentes: convite, capa, cadastro recebido, visibilidade e portal.
- A aba Imóvel mostra os campos resumidos, a capa, a ficha expandida e os fornecedores de uma vez.
- O formulário de 8 etapas já foi trocado pela jornada de 5 etapas, que só aparece em rascunhos.

## Nova estrutura

```text
Cabeçalho compacto: ← Implantação · Vêneto A201 · IMP-00004 · Prospect
                    Bruna Haupenthal · (51) 99626-2235 · [Editar]
                    [Proposta pendente] [Cadastro aguardando] [Prontidão 24%]

Desktop: menu lateral fixo          Celular: seletor de seção no topo
  Visão geral                          (lista em folha inferior)
  Proposta
  Imóvel
  Implantação
  Proprietário
  Portal
  Histórico
```

- A seção aberta fica no endereço (`?secao=`), então dá para compartilhar, voltar e atualizar a página sem perder o lugar.
- **Visão geral:** primeiro o bloco **Próxima ação**, com um botão "Resolver agora" que leva à seção certa. A regra vem de uma função testada: completar contato → condições → publicar proposta → aguardar aceite → cadastro → pendências da implantação. Abaixo, 4 blocos compactos que também são clicáveis: Comercial, Imóvel, Implantação e Proprietário. Nada fica aberto por padrão.
- **Proposta:** um resumo com versão, status, valor, taxa e limpeza comercial, mais os botões Editar proposta, Ver como proprietário e Publicar. A edição completa (serviços, condições, objeto, responsabilidades, versões) abre em uma área dedicada da mesma seção. Versões e snapshots continuam iguais.
- **Imóvel:** capa, identificação e um resumo com o botão "Editar dados". Abaixo, blocos recolhíveis: Identificação e endereço, Composição, Ambientes e camas, Acessos e Wi-Fi, Vistorias e Observações internas. A duplicação de campos acaba.
- **Implantação:** uma visão inicial com prontidão, pendências, bloqueadores e o botão "Resolver pendências". Em seguida, linhas com contador para Enxoval, Itens do imóvel, Itens faltantes, Fornecedores e Checklist; cada linha abre sua área.
  - Enxoval e itens: no celular, lista agrupada por ambiente; no computador, a opção entre Lista e Planilha.
  - Itens faltantes: resumo por situação, e o botão "+ Adicionar item" abre o formulário só quando você precisa.
  - Fornecedores: uma lista de categorias com a situação de cada uma (definido, não informado, não se aplica); o detalhe abre ao tocar.
- **Proprietário:** nome e papel, depois grupos que abrem a edição: contato, cadastro, dados de repasse, documentos, contrato e acesso.
- **Portal:** uma jornada única (Proposta, Link, Acesso, Cadastro, Conta), as ações Copiar link, Abrir como proprietário e Revogar, e depois a Visibilidade com as liberações por bloco. Ações indisponíveis ficam escondidas em vez de aparecerem como botões desativados.
- **Histórico:** reúne em uma linha do tempo o que hoje está espalhado: reuniões, versões da proposta, links, acessos, cadastro, revisões, status e vistorias.
- **Visualizar primeiro, editar por ação explícita**, em painel lateral no computador e folha inferior no celular.
- Cobranças iniciais e a conversão para o Core ficam na seção onde fazem sentido (Proposta e Visão geral quando aplicável) e não se perdem.

## Fora do escopo
Nova oportunidade e cadastro prévio, visual do portal público, Core, financeiro, contratos e vistorias como módulos globais. Cores e fontes continuam como estão.

## Detalhes técnicos
- Dividir `src/routes/implantacao.$id.tsx` (cerca de 2.900 linhas) em `src/components/implantacao/ficha/`: `FichaShell` (cabeçalho, navegação lateral e seletor mobile), `OverviewSection`, `ProposalSection`, `PropertySection`, `ImplementationSection`, `OwnerSection`, `PortalSection` e `HistorySection`. O arquivo da rota passa a só compor essas partes.
- Mover `OwnerTab`, `OwnerPortalPanel`, `PropertyTab`, `Checklist`, `InitialChargesPanel`, `CoreConversionPanel` e `CommercialTermsPanel` para esses arquivos, sem mudar a lógica.
- `validateSearch` passa a aceitar `secao`, mantendo `etapa` para a jornada de rascunho.
- Novo `src/lib/ficha-next-action.ts`, com testes, para a próxima ação e os indicadores do cabeçalho.
- Um componente `Collapsible` compartilhado e um `EditSheet` (painel lateral no computador, folha inferior no celular).
- Lista mobile para `SupplySheet`/`EnxovalTab`, a lista de categorias em `PropertySuppliersPanel` e o formulário recolhível em `MissingItemsTab`, sem mudar as consultas.
- Nenhuma mudança de banco, segurança de acesso, tokens ou snapshots.
- Verificação: typecheck, testes existentes e novos, e capturas antes/depois com Playwright em 375, 390, 430, tablet e 1440 px, incluindo carregando, vazio e erro com "tentar novamente".
