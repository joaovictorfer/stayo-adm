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
- Cadastro comercial do proprietário usa `owner_intake_links` (token próprio, separado por trigger dos links de proposta e onboarding) e grava só em `owner_intake_submissions` via RPC com whitelist; nada chega à ficha sem `admin_review_owner_intake`. Por quê: isolamento de capacidade por construção.
- O portal do proprietário mostra Resumo/Proposta/Documentos só a partir de `portal_visibility_releases` ativos (RLS por `owner_can_access_implementation`), liberados por RPC com autor e data; revisão de dado e liberação são decisões separadas. Por quê: nada vira público por padrão.
- `has_admin_role` sempre retorna booleano (coalesce false); RPCs administrativas não têm EXECUTE para anon. Por quê: NULL passava por `IF NOT has_admin_role(...)`.
- Área operacional do portal (`phase = operation`) exige implantação `ativo` + `core_property_id` + `core_owner_id`; convite ou conta de implantação nunca viram acesso operacional por si. Por quê: ativação controlada vinculada ao Core oficial.
- Marca: sempre `StayoLogo` (src/components/brand/StayoLogo.tsx) com as logos oficiais em src/assets/stayo-logo-*.asset.json (green claro, white escuro, black impressão, sand marca d'água, square-* selos); nunca o nome em texto como logo. Por quê: identidade oficial única.
- Capa do link do proprietário: arquivo no bucket privado `implementation-covers` (`implementations/<id>/` ou `condominiums/<id>/`), escolha em `implementation_projects.cover_source`; público recebe só URL assinada via `getOwnerCover` após RPC `owner_cover_by_token`/`owner_cover_for_implementation`. Por quê: nunca expor bucket nem foto de outro imóvel.
- Nova oportunidade: as três entradas abrem uma única oportunidade em rascunho (`admin_create_draft_opportunity`, idempotente por requestId, origin `admin_draft:*`) e o formulário progressivo em `/implantacao/$id?etapa=...` reutiliza as seções da ficha; concluir grava `draft_completed_at`. Por quê: evitar duplicidade e nenhum campo obrigatório.
