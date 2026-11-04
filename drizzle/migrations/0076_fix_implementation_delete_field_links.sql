CREATE OR REPLACE FUNCTION public.admin_delete_implementation(_id uuid, _confirm_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF public.has_admin_role('super_admin','admin') IS NOT TRUE THEN
    RAISE EXCEPTION 'Sem permissão para excluir implantações.';
  END IF;
  SELECT id, code, status, core_property_id, core_owner_id INTO r
    FROM public.implementation_projects WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Implantação não encontrada.'; END IF;
  IF r.code IS DISTINCT FROM _confirm_code THEN
    RAISE EXCEPTION 'Código de confirmação não confere.';
  END IF;
  IF r.status = 'ativo' OR r.core_property_id IS NOT NULL OR r.core_owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'Implantação ativa ou vinculada ao Core não pode ser excluída.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.stayo_charges WHERE implementation_id = _id) THEN
    RAISE EXCEPTION 'Implantação vinculada a cobranças não pode ser excluída. Preserve o histórico financeiro.';
  END IF;
  DELETE FROM public.implementation_field_links WHERE implementation_id = _id;
  DELETE FROM public.implementation_projects WHERE id = _id;
END $function$;
REVOKE ALL ON FUNCTION public.admin_delete_implementation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_implementation(uuid, text) TO authenticated, service_role;