<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Cadastro comercial usa token próprio em `owner_intake_links`, grava só em `owner_intake_submissions` por RPC whitelist e só chega à ficha por `admin_review_owner_intake`; mantém capacidades isoladas.
- Portal mostra Resumo/Proposta/Documentos só com `portal_visibility_releases` ativo via RPC auditada; revisão e liberação são decisões separadas, logo nada é público por padrão.
- `has_admin_role` retorna booleano com `coalesce false`; RPCs administrativas não concedem EXECUTE a anon, evitando autorização por NULL.
- Operação do portal exige implantação `ativo`, `core_property_id` e `core_owner_id`; convite/conta de implantação não concede acesso operacional.
- Marca usa sempre `StayoLogo` e os assets oficiais `stayo-logo-*`; nunca texto como logo.
- Capa do proprietário é privada; `getOwnerCover` e `/api/public/owner-cover/$token` validam acesso e entregam URL assinada ou fallback.
- Nova oportunidade cria rascunho idempotente e usa `/implantacao/$id?etapa=...`; a jornada compõe o draft versionado, deixando o editor completo para casos avançados.
- Oportunidade salva por `admin_autosave_opportunity` com whitelist/conflito por campo; origem fica em `implementation_field_sources`, evitando sobrescrita silenciosa.
- Condições e decisões vivem só em `implementation_contract_conditions`; snapshots preservam a versão aceita e reconciliam limpeza pós-obra sem duplicidade.
- Fornecedores vivem em `property_supplier_entries` (histórico imutável); correção admin trava; Admin lista por categoria, Portal tem editor próprio.
- Inventário e pendências usam `implementation_supply_items`; falta deriva das quantidades.
- Protótipos de Guias usam rota isolada e estado local, sem APIs.
- Guias utensílios/enxoval/inventário compartilham tabelas e snapshot `admin_apply_guide`; proprietário do inventário só propõe via `owner_inventory_*` (sessão+vínculo) e STAYO decide em `admin_review_inventory_submission`.
- Comodidades e itens do imóvel ficam em implementation_amenities (jsonb por implantação, autosave); empresas novas de móveis entram em supplier_catalog para reaproveitar.
- Comodidades sincronizam o inventário guiado por `amenity_key` (upsert idempotente); desmarcar só desativa o item, nunca grava "Não tenho" nem cria pendência.
- The owner workspace reuses owner records, onboarding people, owner notes and existing invitation actions; presentation changes must not create a second owner or relationship store.
