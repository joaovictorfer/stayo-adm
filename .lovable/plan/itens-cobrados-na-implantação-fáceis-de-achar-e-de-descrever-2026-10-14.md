# Itens cobrados na implantação, fáceis de achar e de descrever

## O que muda para você
Na aba Comercial, o bloco "Valores e vigência" ganha a linha **Itens da implantação**. Ela mostra os itens cobrados (ex.: "Limpeza pós-obra · R$ 300", "Fotos profissionais · R$ 200") e o total.

Ao tocar na linha, ou no lápis de "Valor de implantação", abre uma janela simples. Cada item aparece num cartão com:
- **Nome do item** (o que será cobrado)
- **Valor** e **desconto** (opcional)
- **Descrição**: um texto livre explicando o que está incluído. É o campo que existia antes e ficou escondido.
- **Subitens** (opcional), em lista curta: "Produtos de limpeza", "Retirada de entulho" etc.
- Botões para ligar/desligar o item e para remover

No fim da janela ficam "Adicionar item", os itens padrão sugeridos e o total.

**Salva sozinho**, igual ao resto da aba. Os botões "Salvar rascunho" e "Publicar" saem dessa janela. A mudança já vale para o link e o PDF do proprietário.

O proprietário vê nome, valor e descrição de cada item em "Preparação do imóvel", no link dele.

## Fora do escopo
- Cobranças e pagamentos não são gerados por isso. O selo "Pago" continua igual.
- A janela de "Objeto e responsabilidades" continua como está. Ela pode ganhar o mesmo salvamento automático depois, se você quiser.

## Detalhes técnicos
- Novo `ImplementationItemsDialog` em `ficha/`, reaproveitando `DraftItem`, `ItemScopeEditor` e o cálculo de totais de `ProposalTab` (sem duplicar a lógica; extrair para um módulo compartilhado se necessário).
- Autosave com debounce de cerca de 800 ms. Grava pelo mesmo caminho de rascunho que já existe (`admin_save_proposal_draft`) e depois chama `admin_publish_proposal`, para que o snapshot do proprietário reflita a alteração. Status "Salvando…/Salvo" no rodapé.
- `FichaCommercial`: linha "Itens da implantação" com um resumo dos itens incluídos. O `quick: "implementation"` e a linha "Serviços da implantação" passam a abrir esse diálogo.
- Conferir no preview: adicionar um item com descrição, fechar, reabrir, ver o texto preservado e o item no link do proprietário.
