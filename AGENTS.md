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
- Guide prototypes: local state, no APIs.
- Guides share snapshots via admin_apply_guide; existing owner_inventory_* links submit for STAYO review.
- Comodidades e itens do imóvel ficam em implementation_amenities (jsonb por implantação, autosave); empresas novas de móveis entram em supplier_catalog para reaproveitar.
- Comodidades sincronizam o inventário guiado por `amenity_key` (upsert idempotente); desmarcar só desativa o item, nunca grava "Não tenho" nem cria pendência. Item agrupado mantém a `amenity_key` própria e só desliga se o grupo for "Não"; agrupar nunca apaga resposta nem espelho anterior.
- Amenities match inventory rows through a presentation adapter; installation defaults, per-room overrides and characteristics live in the amenities JSON with field-level source metadata, so a room edit stays local.
- Inventory uses shared Row/DetailLayout/DetailFields and read-only media (PDF first); additions reuse addInventoryItem; detail adapters preserve each source.
- Shared tokens govern fonts/admin motion with reduced motion; one root auth provider deduplicates session/profile reads and clears request-local query caches on identity changes for account isolation.
- Owner workspace reuses records and masks sensitive data. OwnerLinksHub preserves invitation capabilities in existing scoped panels.
- Read nested AGENTS.md before edits, including Central API and Pagar.me settings rules.

- Implementation defaults to the workspace; explicit etapa opens registration, and resume fetches draft_step freshly to preserve continuity.
- Contract registration reuses OwnerJourney and invitation-authorized contact reconciliation; commercial intake and read-only presentation keep distinct capabilities to preserve existing links and avoid duplicate contract records.
- Owner channels live on implementation_projects (distribution_channels, airbnb_account_email) via owner_platforms_save; allowed_channels is the STAYO release policy (NULL = all, Airbnb always on, trigger prunes the owner answer); copy in src/lib/api/owner-platforms.ts.
- Existing invitation inventory uses owner_inventory_*_by_token after proposal confirmation; submitted_by is the invitation id and STAYO reviews.
- Owner onboarding marital status and profession live per person in owner_onboarding_people (position 0 = principal); public onboarding no longer requires owner address or person type, and saves never null out existing address values — keeps one source for contract data.
- Bedrooms is canonical in implementation_projects; invitation PATCH is conflict-aware. getPropertyDetails uses canonical bedrooms and derives suites from persisted amenities rooms, falling back only without room data.
- VF Financeiro uses role-protected server functions and strict DTOs; credentials stay server-only. Expense transmission requires deployment opt-in and per-call confirmation to prevent unauthorized writes.
- Dedicated registration uses hashed expiring capabilities, serialized revisioned saves and atomic inventory entry. Inventory templates reconcile inventory_room_key (room ID; private bath = ID + :bath) in place, preserving answers/IDs; SurveyExperience retains legacy capability grouping.
- Implementation deletion stays in the guarded admin RPC: remove project-owned field capabilities transactionally, but reject Core-linked, active or charge-linked projects to preserve operational and financial history.
- Charges: isolated local prototypes; real charges use core-client, role-checked RPCs, revision locks, immutable snapshots and hashed expiring read-only links; never alter VF finances.
- Central API preparation uses revisioned provider projections and a read-only adapter; production is fail-closed until explicit homologation, and guest CPF has no public or portal RPC.

- Commercial conditions publish only via `admin_publish_conditions` (working row autosaves internally; owner sees snapshots only); `standard_copy` on contract conditions marks per-property exceptions, and value-vs-text change rules mirror `src/lib/commercial-standard.ts` — keeps the accepted version immutable.
- Field divergences (owner official vs submitted, property registration vs room collection) are computed in `src/lib/field-sources.ts` and never auto-applied; team decisions persist in `implementation_field_confirmations` as `div:<key>` with a value snapshot so a new value reopens the divergence.
