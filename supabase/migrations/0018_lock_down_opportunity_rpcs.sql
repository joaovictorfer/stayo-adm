-- Fase 1 — least privilege para as RPCs de oportunidade.
--
-- O Lovable Cloud/Supabase aplica grants diretos de EXECUTE a `anon`
-- na criação de novas functions. A migration 0017 já restringe o corpo
-- das RPCs por `has_admin_role`, mas este ajuste remove também a capacidade
-- de invocação anônima no nível de grant.
--
-- Incremental: não altera a 0017 já materializada e preserva `authenticated`
-- e acessos internos do ambiente.

revoke execute on function public.admin_create_opportunity(jsonb) from anon;
revoke execute on function public.admin_find_owner_phone_duplicates(text) from anon;

revoke execute on function public.admin_create_opportunity(jsonb) from public;
revoke execute on function public.admin_find_owner_phone_duplicates(text) from public;

grant execute on function public.admin_create_opportunity(jsonb) to authenticated;
grant execute on function public.admin_find_owner_phone_duplicates(text) to authenticated;
