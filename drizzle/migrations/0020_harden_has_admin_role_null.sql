-- Sem perfil administrativo, has_admin_role devolvia NULL; "IF NOT NULL" não bloqueava.
CREATE OR REPLACE FUNCTION public.has_admin_role(VARIADIC roles admin_role[])
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select coalesce(current_admin_role() = any(roles), false);
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_release_portal_block(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_hide_portal_block(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_owner_intake(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.portal_attachment_released(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_release_portal_block(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hide_portal_block(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_owner_intake(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_attachment_released(uuid, uuid) TO authenticated;