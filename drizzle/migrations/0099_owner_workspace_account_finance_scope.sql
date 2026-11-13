CREATE OR REPLACE FUNCTION public.owner_workspace_for_account(p_implementation_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT l.snapshot FROM public.owner_workspace_links l JOIN public.implementation_projects p ON p.id=l.implementation_id AND p.owner_id=l.owner_id WHERE l.implementation_id=p_implementation_id AND l.revoked_at IS NULL AND l.expires_at>now() AND public.owner_can_access_implementation(l.implementation_id) AND EXISTS(SELECT 1 FROM public.owner_portal_accounts WHERE id=auth.uid() AND role IN ('titular','coproprietario')) ORDER BY l.created_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.owner_workspace_for_account(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_workspace_for_account(uuid) TO authenticated;