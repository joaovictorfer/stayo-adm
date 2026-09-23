CREATE OR REPLACE FUNCTION public.owner_can_access_implementation(p_implementation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.owner_portal_accounts opa
    WHERE opa.id = auth.uid()
      AND (
        EXISTS (
          SELECT 1 FROM public.implementation_projects ip
          WHERE ip.id = p_implementation_id AND ip.owner_id = opa.owner_id
        )
        OR EXISTS (
          SELECT 1 FROM public.implementation_owners io
          WHERE io.implementation_id = p_implementation_id AND io.owner_id = opa.owner_id
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.owner_can_access_implementation(uuid) TO authenticated;

ALTER TABLE public.implementation_property_details
  ADD COLUMN IF NOT EXISTS access_type text,
  ADD COLUMN IF NOT EXISTS access_code text;

ALTER TABLE public.implementation_property_details
  ADD CONSTRAINT implementation_property_details_access_type_check
  CHECK (access_type IS NULL OR access_type IN ('key', 'lock', 'concierge', 'other')) NOT VALID;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.implementation_property_details TO authenticated;
GRANT ALL ON public.implementation_property_details TO service_role;

CREATE POLICY "proprietario le dados dos proprios imoveis"
ON public.implementation_property_details
FOR SELECT TO authenticated
USING (public.owner_can_access_implementation(implementation_id));

CREATE POLICY "proprietario cadastra dados dos proprios imoveis"
ON public.implementation_property_details
FOR INSERT TO authenticated
WITH CHECK (public.owner_can_access_implementation(implementation_id));

CREATE POLICY "proprietario atualiza dados dos proprios imoveis"
ON public.implementation_property_details
FOR UPDATE TO authenticated
USING (public.owner_can_access_implementation(implementation_id))
WITH CHECK (public.owner_can_access_implementation(implementation_id));

CREATE TABLE public.implementation_timeline_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'update',
  owner_visible boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT implementation_timeline_updates_kind_check CHECK (kind IN ('update', 'budget', 'stage', 'forecast', 'inspection', 'document'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implementation_timeline_updates TO authenticated;
GRANT ALL ON public.implementation_timeline_updates TO service_role;
ALTER TABLE public.implementation_timeline_updates ENABLE ROW LEVEL SECURITY;
CREATE INDEX implementation_timeline_updates_impl_date_idx ON public.implementation_timeline_updates (implementation_id, event_date DESC);

CREATE POLICY "time interno le atualizacoes da timeline"
ON public.implementation_timeline_updates
FOR SELECT TO authenticated
USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "time interno gerencia atualizacoes da timeline"
ON public.implementation_timeline_updates
FOR ALL TO authenticated
USING (public.has_admin_role('super_admin','admin','commercial','operations'))
WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE POLICY "proprietario le atualizacoes publicadas"
ON public.implementation_timeline_updates
FOR SELECT TO authenticated
USING (owner_visible AND public.owner_can_access_implementation(implementation_id));

CREATE TABLE public.implementation_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'implantacao',
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_for timestamptz,
  completed_at timestamptz,
  public_notes text,
  internal_notes text,
  owner_visible boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT implementation_inspections_type_check CHECK (type IN ('implantacao','entrada','saida','periodica','manutencao','inventario')),
  CONSTRAINT implementation_inspections_status_check CHECK (status IN ('scheduled','in_progress','completed','cancelled'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implementation_inspections TO authenticated;
GRANT ALL ON public.implementation_inspections TO service_role;
ALTER TABLE public.implementation_inspections ENABLE ROW LEVEL SECURITY;
CREATE INDEX implementation_inspections_impl_date_idx ON public.implementation_inspections (implementation_id, scheduled_for DESC);

CREATE POLICY "time interno le vistorias"
ON public.implementation_inspections
FOR SELECT TO authenticated
USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "time interno gerencia vistorias"
ON public.implementation_inspections
FOR ALL TO authenticated
USING (public.has_admin_role('super_admin','admin','commercial','operations'))
WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE POLICY "proprietario le vistorias liberadas"
ON public.implementation_inspections
FOR SELECT TO authenticated
USING (owner_visible AND public.owner_can_access_implementation(implementation_id));

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS inspection_id uuid REFERENCES public.implementation_inspections(id) ON DELETE SET NULL;

CREATE INDEX attachments_inspection_id_idx ON public.attachments (inspection_id);

CREATE TRIGGER implementation_inspections_set_updated_at
BEFORE UPDATE ON public.implementation_inspections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();