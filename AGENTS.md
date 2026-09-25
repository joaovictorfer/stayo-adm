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
