# Guia de Enxoval da implantação

## Autorização necessária
Uma migration pequena é necessária: hoje as funções do portal e a liberação só aceitam o Guia de Utensílios. **Aprovar este plano autoriza aplicá-la no banco** (o mesmo banco da prévia e do app publicado). Nenhuma tabela, bucket ou política nova será criada.

## Estado confirmado
- A infraestrutura de Guias já existe e é genérica (`guide_type` aceita `enxoval`): catálogo, cópia por implantação, respostas, revisão, fotos e auditoria.
- Não existe lista oficial de enxoval:
  - os modelos de compra (`supply_templates`) estão vazios;
  - o catálogo de compras tem só 7 nomes soltos de uso real (ex.: "Toalha de banho", "Ferro T1280");
  - no código, "Toalha de banho" e "Jogo de Lençol" aparecem apenas como exemplos de preenchimento.
- **Por isso o catálogo inicial de enxoval não será preenchido: nenhuma Fonte Mestra atual definiu os itens.**

## O que muda para você
**Ficha → Implantação → "Preparação do imóvel"**
- Duas linhas compactas: **Guia de utensílios** e **Guia de enxoval**, cada uma com recomendações, concluídas, a confirmar e situação no portal (Visível ou Privado). Itens faltantes fica logo abaixo.
- O Guia de enxoval tem a mesma tela do de utensílios: resumo, chave própria de visibilidade, categorias (as sugeridas são Cama, Banho, Cozinha e Complementos, e outras podem ser criadas livremente), busca, filtros, detalhe e Confirmar/Corrigir/Rejeitar.
- Sem guia aplicado, aparecem **"Aplicar modelo STAYO"** (desativado com o aviso "catálogo vazio" enquanto não houver itens) e **"Começar vazio"**.
- O editor ganha o campo **"Tamanho / medida / padrão"**.

**Configurações → Catálogo de guias:** abas Utensílios e Enxoval, para a equipe cadastrar o catálogo de enxoval quando tiver a lista oficial.

**Portal → "Prepare seu imóvel":** dois cartões independentes (Utensílios e Enxoval), cada um com seu progresso ("12 de 20 informados") e só aparecendo se estiver liberado. O item no portal é igual ao de utensílios, com o texto padrão de indicação de compra.

**Regras mantidas:** a resposta do proprietário nunca altera o inventário. Só o "Confirmar" da equipe gera o item faltante, sem duplicar. As liberações de utensílios e enxoval são independentes.

## Fora do escopo
Criar modelos por tipo de imóvel (1 ou 2 dormitórios etc.): não há fonte. A estrutura aceita um modelo por tipo de guia; vários modelos ficam para quando houver conteúdo.

## Detalhes técnicos
- Migration incremental:
  - adiciona `size_text` (nulo) em `guide_catalog_items` e `implementation_guide_items`;
  - amplia a restrição de `portal_visibility_releases.block` para incluir `guia_enxoval`;
  - `admin_release_portal_block` passa a aceitar `guia_enxoval`, exigindo itens de enxoval aplicados;
  - `admin_apply_guide` passa a copiar `size_text`;
  - `owner_guide_resolve`, `owner_guide_image_paths` e `owner_guide_save` ganham o parâmetro `p_guide_type`, validado contra o bloco correspondente (`utensils_guide` para utensílios, `guia_enxoval` para enxoval). A versão antiga de um parâmetro continua funcionando para utensílios. O save confere que o item pertence ao tipo liberado.
- Código: `guideType` em `src/lib/api/guides.ts`, `UtensilsGuidePanel` vira `GuidePanel` com a prop `guideType`, `OwnerUtensilsGuide` vira `OwnerGuide` com a mesma prop e ambos são renderizados no portal. O servidor de imagens recebe `guideType`, e o editor ganha o campo de tamanho.
- Sem seed. Os dados de teste são apagados ao final.
- Testes:
  - unitários: resumo por tipo;
  - banco: acesso sem token, token inválido, enxoval não liberado enquanto utensílios está liberado, item de outro tipo ou imóvel, confirmação idempotente;
  - regressão de utensílios;
  - Playwright na ficha (390 px e desktop) e no portal (390 px).
- Os testes com token expirado ou revogado dependem de fixtures que não existem hoje. Serão feitos se houver um convite expirado ou revogado disponível; caso contrário, ficam como pendência declarada.
