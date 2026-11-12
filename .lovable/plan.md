# Importar proprietários e imóveis do Stayo Guia

## O que o arquivo traz
- 22 imóveis, 8 proprietários, 4 vínculos, 2 contas bancárias, 4 contratos, 40 solicitações de cadastro.
- Só 6 imóveis têm proprietário: Delle Alpi 506B, Laje de Pedra, Le Monde A403 (2 proprietárias), Vêneto B104, Vêneto G304, Vêneto H403.
- Vários proprietários parecem cadastros de teste: "FINAL PJ c7gzqs", "Novo Proprietário" (2x) e "Marcos" sem CPF.
- Imóveis já completos aqui (C203, B406, D306, A201, A106, A206) aparecem sem proprietário no Guia.

## Regras da importação
1. Comparar cada imóvel pelo código (ex.: VE-B104) com as fichas existentes; criar ficha só quando não existir.
2. Comparar proprietário pelo CPF/CNPJ, depois pelo nome; nunca duplicar.
3. Nunca apagar nem sobrescrever dado já preenchido no ADM. O Guia só completa campos vazios.
4. Ignorar cadastros de teste e registros excluídos na origem.
5. Rita de Cássia (sem CPF) entra como titular de Laje de Pedra e Vêneto G304, marcada como "CPF pendente".
6. Le Monde A403 recebe as duas proprietárias (titular + coproprietária).
7. Contas bancárias e Pix entram só onde não houver conta cadastrada.
8. Guardar o identificador do Guia em cada registro para rastrear de onde veio.

## Entrega
- Prévia em tabela antes de gravar: o que será criado, completado ou ignorado.
- Após gravar: relatório com pendências (imóveis sem proprietário, CPFs faltando).

## Detalhes técnicos
- Gravação única e atômica nas tabelas de proprietários, fichas, perfil de cadastro, pessoas e contas de repasse.
- Contratos e as 40 solicitações de cadastro ficam fora desta etapa (só listados no relatório).
