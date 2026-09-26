# Guia de Utensílios da implantação

## Autorização necessária
A especificação pede que nenhuma mudança seja aplicada ao banco real sem autorização específica sua. Este guia precisa de tabelas novas, e há um único banco para a prévia e o app publicado.
**Aprovar este plano autoriza aplicar a migration descrita abaixo.** Se preferir só o código, sem mexer no banco, rejeite o plano e diga isso; eu entrego o SQL versionado sem aplicar.

## Estado confirmado
- `supply_templates` e `supply_template_items` existem, mas estão vazias (0 linhas) e são específicas de enxoval/faltantes. Não têm foto, descrição, dica, link nem classificação.
- `supply_catalog_items` tem 6 itens e serve só para autocompletar compras. `implementation_supply_items` é o inventário oficial (1 item hoje).
- `portal_visibility_releases` usa hoje os blocos "overview" e "proposal".
- Já existe um padrão igual ao pedido: Fornecedores do imóvel, com respostas do proprietário pelo token do convite, revisão da STAYO e histórico. O guia seguirá esse modelo.
- Há três áreas privadas de arquivos (capas, anexos do proprietário, documentos de compras).

## O que será construído

**Na ficha → Implantação → "Guia de utensílios"**
- Resumo em uma linha: 32 recomendações · confirmadas · a confirmar · pendentes.
- Chave "Visível ao proprietário".
- Abas Cozinha, Quartos e Banheiros, com busca e os filtros Todos, A confirmar, Faltando, Concluídos e Não informados.
- Cada item aparece como linha compacta: foto, nome, quantidade, classificação e situação da resposta do proprietário. Ao tocar, abre o detalhe.
- Botão "+ Item" abre um painel com: categoria, nome, quantidade, unidade, classificação, foto, descrição, dica STAYO, link de compra, ordem e ativo. Tem também a opção "Adicionar também ao catálogo STAYO".
- Botão "Aplicar guia STAYO" copia o catálogo para a implantação. Mudanças futuras no catálogo não alteram cópias já aplicadas.
- Na revisão, "Confirmar" atualiza o inventário oficial sem duplicar itens. Exemplo: recomendado 6, o proprietário tem 4 → necessários 6, existentes 4, e os itens faltantes mostram 2. "Corrigir" permite ajustar a quantidade antes de confirmar.

**Em Configurações → "Catálogo de guias"**
- Lista e edição das recomendações reutilizáveis da STAYO.

**No Portal do Proprietário (só quando liberado)**
- Cartão "Prepare seu imóvel · Guia de utensílios · 18 de 32 informados" com o botão "Ver guia".
- Categorias em abas. Cada cartão mostra foto, nome, quantidade, descrição, dica, "Ver indicação de compra ↗" e o aviso de que é apenas referência.
- Respostas: Ainda não comprei, Já tenho ou Já comprei, com quantidade ajustável e salvamento.
- Quando não liberado, a área simplesmente não aparece.

**Carga inicial:** os 32 itens da especificação (27 de cozinha, 2 de quartos, 3 de banheiros), com a dica genérica de fácil reposição onde pertinente, sem links e sem fotos. As fotos do PDF não serão importadas.

## Fora do escopo
Guia de Enxoval (a estrutura já aceita esse tipo, mas ele não será criado), compra, checkout, afiliados, integração com lojas, WhatsApp.

## Detalhes técnicos
- Uma migration nova com tabelas genéricas para os dois tipos (`guide_type`: `utensilios` | `enxoval`):
  - `guide_catalog_items`: categoria, nome, quantidade, unidade, descrição, dica, `purchase_url`, `image_path`, classificação (essencial/recomendado/opcional), ativo, ordem.
  - `implementation_guide_items`: cópia com `catalog_item_id` e todos os campos personalizáveis, `enabled` e ordem.
  - `implementation_guide_responses`: `answer` (nao_informado/ja_tenho/ja_comprei), quantidade, origem, `review_status` (pendente/confirmado/corrigido/rejeitado), `reviewed_by`, `reviewed_at`, quantidade confirmada, nota interna e `supply_item_id` vinculado.
  - GRANTs e RLS: leitura e escrita via `has_admin_role` para os mesmos papéis de implantação; nada para anon.
- RPCs:
  - `admin_apply_guide(implementation, type)`: idempotente, não duplica itens.
  - `admin_confirm_guide_response`: com papel exigido e bloqueio, faz upsert em `implementation_supply_items` (`required_qty` = recomendado, `existing_qty` = confirmado, module `faltante`), mantém o vínculo para não duplicar e grava em `audit_logs`.
  - `owner_guide_resolve(token)` e `owner_guide_save(token, respostas)`: `security definer`, token do convite do proprietário (o mesmo padrão de Fornecedores, nunca o token público da proposta). Validam expiração, revogação e a liberação do bloco `utensils_guide`, devolvem só a lista pública (sem notas internas), e a escrita é limitada às respostas daquela implantação. Qualquer resposta nova volta para `pendente`.
- Visibilidade: novo bloco `utensils_guide` em `portal_visibility_releases` (liberar e revogar pelas RPCs existentes, que serão ampliadas se validarem a lista de blocos).
- Fotos: novo bucket privado `guide-images` com caminhos `catalog/<id>/` e `implementations/<id>/`, validação de tipo (jpg/png/webp) e tamanho (até 5 MB), com substituição e remoção. O portal recebe só URLs assinadas por uma função de servidor após a checagem do token, como já é feito com a capa.
- Validação de URL (só http/https) no painel e no banco.
- Código: `src/lib/api/guides.ts`, `src/components/implantacao/guide/` (lista, painel de edição, revisão), `src/components/portal/OwnerUtensilsGuide.tsx`, e uma linha nova no hub "Implantação" da ficha.
- Testes: unitários para os resumos e a regra de confirmação. Verificações no banco para acesso sem token, token inválido, expirado, revogado ou de outro imóvel, aplicação idempotente, independência da cópia e confirmação idempotente no inventário. Playwright no admin (390 px e desktop) e no portal (390 px).
