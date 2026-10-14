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
- Instalações e prestadores do imóvel se registram por ambiente no inventário; a ficha não tem painel separado — `property_supplier_entries` é histórico imutável, lido só em `/implantacao/fornecedores`.
- Inventário e pendências usam `implementation_supply_items`; falta deriva das quantidades.
- Protótipos de Guias usam rota isolada e estado local, sem APIs.
- Guias utensílios/enxoval/inventário compartilham tabelas e snapshot `admin_apply_guide`; proprietário do inventário só propõe via `owner_inventory_*` (sessão+vínculo) e STAYO decide em `admin_review_inventory_submission`.
- Comodidades e itens do imóvel ficam em implementation_amenities (jsonb por implantação, autosave); empresas novas de móveis entram em supplier_catalog para reaproveitar.
- Comodidades sincronizam o inventário guiado por `amenity_key` (upsert idempotente); desmarcar só desativa o item, nunca grava "Não tenho" nem cria pendência. Item agrupado mantém a `amenity_key` própria e só desliga se o grupo for "Não"; agrupar nunca apaga resposta nem espelho anterior.
- Amenities match inventory rows through a presentation adapter; installation defaults, per-room overrides and characteristics live in the amenities JSON with field-level source metadata, so a room edit stays local.
- Inventory uses shared Row/DetailLayout/DetailFields and read-only media (PDF first); additions reuse addInventoryItem; detail adapters preserve each source.
- Shared tokens govern fonts/admin motion with reduced motion; one root auth provider deduplicates session/profile reads and clears request-local query caches on identity changes for account isolation.
- The owner workspace reuses owner records, onboarding people, owner notes and existing invitation actions; presentation changes must not create a second owner or relationship store.

- The implementation route renders the administrative workspace by default; only an explicit etapa search parameter opens the guided registration, and resuming loads draft_step freshly to preserve the same workspace across proposal publication.
- Contract registration reuses OwnerJourney and invitation-authorized contact reconciliation; commercial intake and read-only presentation keep distinct capabilities to preserve existing links and avoid duplicate contract records.
- Owner channels live on implementation_projects (distribution_channels, airbnb_account_email) via owner_platforms_save; allowed_channels is the STAYO release policy (NULL = all, Airbnb always on, trigger prunes the owner answer); copy in src/lib/api/owner-platforms.ts.
- Pre-account owner answers to the implementation inventory go through owner_inventory_*_by_token (invitation token + confirmed proposal), stored as implementation_inventory_submissions with submitted_by = invitation id, so STAYO's existing review stays the only path to the official item.
- Owner onboarding marital status and profession live per person in owner_onboarding_people (position 0 = principal); public onboarding no longer requires owner address or person type, and saves never null out existing address values — keeps one source for contract data.
- During implementation, bedrooms is canonical in implementation_projects; invitation property edits use whitelisted per-field PATCH with expected-value conflicts, and details.bedrooms is a deprecated one-way compatibility mirror to prevent competing sources. Legacy database intake review still targets the mirror (the trigger prevents competing values); authenticated property panels read the project through getPropertyDetails, and AmenitiesPanel writes the project only for bedrooms.
