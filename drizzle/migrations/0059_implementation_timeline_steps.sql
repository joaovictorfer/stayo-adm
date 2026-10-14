CREATE TABLE public.implementation_timeline_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.implementation_timeline_steps (implementation_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implementation_timeline_steps TO authenticated;
GRANT ALL ON public.implementation_timeline_steps TO service_role;
ALTER TABLE public.implementation_timeline_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read timeline" ON public.implementation_timeline_steps FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "admins write timeline" ON public.implementation_timeline_steps FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));