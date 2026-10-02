CREATE TABLE public.implementation_amenities (
  implementation_id uuid PRIMARY KEY REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.implementation_amenities TO authenticated;
GRANT ALL ON public.implementation_amenities TO service_role;
ALTER TABLE public.implementation_amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads amenities" ON public.implementation_amenities FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "team inserts amenities" ON public.implementation_amenities FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE POLICY "team updates amenities" ON public.implementation_amenities FOR UPDATE TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE OR REPLACE FUNCTION public.implementation_amenities_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); NEW.updated_by := auth.uid(); RETURN NEW; END $$;
CREATE TRIGGER implementation_amenities_stamp BEFORE UPDATE ON public.implementation_amenities
  FOR EACH ROW EXECUTE FUNCTION public.implementation_amenities_stamp();