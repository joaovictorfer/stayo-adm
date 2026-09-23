ALTER TABLE public.admin_condominiums
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS has_concierge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concierge_phone text;

ALTER TABLE public.implementation_projects ADD COLUMN IF NOT EXISTS condominium_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid='public.implementation_projects'::regclass AND c.contype='f' AND a.attname='condominium_id'
  ) THEN
    ALTER TABLE public.implementation_projects
      ADD CONSTRAINT implementation_projects_condominium_id_fkey
      FOREIGN KEY (condominium_id) REFERENCES public.admin_condominiums(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS implementation_projects_condominium_id_idx ON public.implementation_projects(condominium_id);

CREATE OR REPLACE FUNCTION public.admin_condominiums_compute_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.status := CASE
    WHEN coalesce(btrim(NEW.name),'') <> '' AND coalesce(btrim(NEW.address),'') <> ''
     AND coalesce(btrim(NEW.city),'') <> ''
     AND (NOT NEW.has_concierge OR coalesce(btrim(NEW.concierge_phone),'') <> '')
    THEN 'complete' ELSE 'pending' END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS admin_condominiums_status ON public.admin_condominiums;
CREATE TRIGGER admin_condominiums_status BEFORE INSERT OR UPDATE ON public.admin_condominiums
  FOR EACH ROW EXECUTE FUNCTION public.admin_condominiums_compute_status();

UPDATE public.admin_condominiums SET updated_at = updated_at;