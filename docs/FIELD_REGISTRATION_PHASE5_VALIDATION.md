# Cadastro e vistoria — validação da Fase 5

Data: 18/10/2026. Validação real em navegador, pelo link dedicado gerado no painel, sem sessão administrativa no contexto público.

## Conferido
- Geração do link em `/implantacao`, criação de ficha nova ao preencher contato e salvamento automático.
- Empreendimento, unidade 505, box B05, Wi-Fi opcional, 2 quartos, 2 banheiros totais e 0 lavabos.
- Suíte no primeiro quarto com 1 Queen; segundo quarto com 2 Solteiro. Retomada preservou a distribuição.
- Entrada na vistoria pelo próprio link dedicado; resposta Tem, quantidade 2, estado Novo, observação e foto enviados e lidos novamente após recarregar.
- Troca para Sala e resposta Não tem; celular 390 × 844 sem transbordamento horizontal e tablet 820 × 1180.
- Painel autenticado: contato, unidade, box, Wi-Fi e contagens presentes; resumo mostrou 4/59 respostas e a linha Forma de pizza mostrou atualização STAYO. Quarto 1 mostrou indicador de suíte, linha Suíte 01 · Camas e banheiro privativo.
- 193 testes passaram em 37 arquivos. Nenhum erro de página nos percursos observados.

## Divergências encontradas — validação não totalmente aprovada
1. A vistoria oferece grupos `Suíte 01`, `Quarto 1`, `Quarto 2`, `Banheiro 1` e `Banheiro 2`, enquanto a composição canônica tem Suíte 01, Quarto 02 e um único banheiro social. A preparação gera templates por contagem, sem identidade canônica de ambiente; camas usam uma segunda convenção de nome. Não implica perda da resposta conferida, mas fragmenta a navegação e o vínculo do banheiro privativo.
2. A seção Proprietário mostra Suítes como Não informado, apesar do indicador verdadeiro na composição e no inventário. É uma divergência de resumo.

Origem do primeiro ponto: `field_registration_prepare_inventory` em `drizzle/migrations/0065_field_registration_consistency.sql`, também existente em 0064; 0066 apenas aposenta camas. A correção deve reconciliar templates em lugar, preservar respostas e manter capacidades existentes. Nenhuma alteração funcional feita nesta etapa de validação.

## Limpeza
Foto removida pelo link autorizado antes da exclusão. Link dedicado e observação de teste removidos de forma restrita; ficha IMP-00012 removida pelo painel. Nenhum imóvel real foi usado para responder itens. Evidências e scripts desta execução ficam em `/tmp/browser/phase5`, não são fixtures permanentes.

## Limites
Não foram exercitados conflitos simultâneos, expiração temporal do link ou transmissão financeira. A conferência do painel foi por recarregamento/navegação, não promessa de atualização em tempo real. Publicação não solicitada nem realizada.

## Correção e nova validação — 18/10/2026
- Preparação da vistoria passou a reconciliar os templates por identidade canônica, preservando IDs, respostas e vínculos de mídia. Templates excedentes só são desativados quando não têm respostas ou vínculos.
- Cenário descartável: 2 quartos, 1 suíte, 2 banheiros totais. Seletor apresentou Cozinha, Sala, Quarto 02, Suíte 01, Banheiro 01 e Banheiro Suíte 01, sem duplicar o quarto da suíte ou criar segundo banheiro social.
- Resposta Tem no chuveiro do banheiro privativo permaneceu após recarregar e preparar a vistoria novamente. O painel apresentou o chuveiro respondido dentro do Quarto 1 com suíte e apenas um banheiro social separado.
- Aba Proprietário mostrou Suítes: 1, derivado da composição persistida. Quarto preservou a cama Queen.
- 14 testes passaram em quatro arquivos; prévia sem erros de página no percurso final e compilação conferida sem erros.
- As duas fichas descartáveis IMP-00012/IMP-00013 foram excluídas pelo painel; contatos descartáveis sem vínculos foram removidos. Nenhum imóvel real foi respondido nesta validação. Sem publicação.
- Limite: registros antigos com respostas excedentes não são apagados nem mesclados automaticamente; sua preservação tem prioridade sobre ocultação indiscriminada.