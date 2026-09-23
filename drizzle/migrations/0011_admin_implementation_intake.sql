CREATE TABLE public.admin_condominiums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  status text NOT NULL DEFAULT 'pending',
  cover_image text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_condominiums_status_check CHECK (status IN ('pending','complete'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_condominiums TO authenticated;
GRANT ALL ON public.admin_condominiums TO service_role;
ALTER TABLE public.admin_condominiums ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX admin_condominiums_name_city_unique ON public.admin_condominiums (lower(name), lower(coalesce(city, '')));
CREATE POLICY "time interno le condominios administrativos" ON public.admin_condominiums FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "time interno gerencia condominios administrativos" ON public.admin_condominiums FOR ALL TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations')) WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));

ALTER TABLE public.implementation_projects
  ADD COLUMN condominium_id uuid REFERENCES public.admin_condominiums(id),
  ADD COLUMN tower text;
ALTER TABLE public.implementation_property_details
  ADD COLUMN parking_box text;

CREATE OR REPLACE FUNCTION public.admin_create_implementation(p_data jsonb)
RETURNS public.implementation_projects
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project public.implementation_projects%rowtype;
  v_code text;
  v_sequence integer;
BEGIN
  IF NOT public.has_admin_role('super_admin','admin','commercial','operations') THEN
    RAISE EXCEPTION 'sem permissão para criar implantação';
  END IF;
  IF nullif(trim(p_data->>'ownerId'), '') IS NULL THEN RAISE EXCEPTION 'proprietário obrigatório'; END IF;
  IF nullif(trim(p_data->>'condominiumName'), '') IS NULL THEN RAISE EXCEPTION 'condomínio obrigatório'; END IF;
  IF nullif(trim(p_data->>'unit'), '') IS NULL THEN RAISE EXCEPTION 'unidade obrigatória'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('implementation_code_sequence'));
  SELECT coalesce(max((regexp_match(code, '^IMP-([0-9]+)$'))[1]::integer), 0) + 1
  INTO v_sequence FROM public.implementation_projects;
  v_code := 'IMP-' || lpad(v_sequence::text, 5, '0');

  INSERT INTO public.implementation_projects (
    code, status, owner_id, condominium_id, condominium_name, tower, unit,
    address, city, responsible_user_id, notes, origin, cover_image
  ) VALUES (
    v_code, 'prospect', (p_data->>'ownerId')::uuid,
    nullif(p_data->>'condominiumId', '')::uuid, nullif(trim(p_data->>'condominiumName'), ''),
    nullif(trim(p_data->>'tower'), ''), nullif(trim(p_data->>'unit'), ''),
    nullif(trim(p_data->>'address'), ''), nullif(trim(p_data->>'city'), ''),
    nullif(p_data->>'responsibleUserId', '')::uuid, nullif(trim(p_data->>'notes'), ''),
    'admin_quick_create', nullif(trim(p_data->>'coverImage'), '')
  ) RETURNING * INTO v_project;

  INSERT INTO public.implementation_contract_conditions (
    implementation_id, administration_fee, cleaning_responsibility, payout_rule,
    maintenance_limit, exclusivity, duration_months, notice_period_days, updated_at
  ) VALUES (
    v_project.id, nullif(p_data->>'administrationFee', '')::numeric,
    nullif(trim(p_data->>'cleaningResponsibility'), ''), nullif(trim(p_data->>'payoutRule'), ''),
    nullif(p_data->>'maintenanceLimit', '')::numeric, coalesce((p_data->>'exclusivity')::boolean, true),
    nullif(p_data->>'durationMonths', '')::integer, nullif(p_data->>'noticePeriodDays', '')::integer, now()
  );

  INSERT INTO public.implementation_property_details (
    implementation_id, city, parking_spots, parking_box, access_type, access_notes,
    access_code, wifi_network, wifi_password, notes, updated_at
  ) VALUES (
    v_project.id, nullif(trim(p_data->>'city'), ''),
    CASE WHEN nullif(trim(p_data->>'parkingBox'), '') IS NULL THEN NULL ELSE 1 END,
    nullif(trim(p_data->>'parkingBox'), ''),
    CASE WHEN nullif(trim(p_data->>'lockPassword'), '') IS NULL THEN NULL ELSE 'lock' END,
    nullif(trim(p_data->>'observations'), ''), nullif(trim(p_data->>'lockPassword'), ''),
    nullif(trim(p_data->>'wifiNetwork'), ''), nullif(trim(p_data->>'wifiPassword'), ''),
    nullif(trim(p_data->>'observations'), ''), now()
  );

  RETURN v_project;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_implementation(jsonb) TO authenticated;
GRANT ALL ON public.admin_condominiums TO service_role;