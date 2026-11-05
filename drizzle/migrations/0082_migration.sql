CREATE UNIQUE INDEX IF NOT EXISTS implementation_projects_core_property_unique ON public.implementation_projects (core_property_id) WHERE core_property_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.implementation_require_app_link_for_active()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'ativo' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ativo') AND NEW.core_property_id IS NULL THEN
    RAISE EXCEPTION 'Vincule o imóvel do STAYO APP antes de marcar como Ativo.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS implementation_require_app_link_for_active ON public.implementation_projects;
CREATE TRIGGER implementation_require_app_link_for_active BEFORE INSERT OR UPDATE OF status, core_property_id ON public.implementation_projects
FOR EACH ROW EXECUTE FUNCTION public.implementation_require_app_link_for_active();