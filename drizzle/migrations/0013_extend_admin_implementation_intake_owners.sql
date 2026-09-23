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
  v_owner_id uuid;
  v_owner jsonb;
  v_order integer := 1;
BEGIN
  IF NOT public.has_admin_role('super_admin','admin','commercial','operations') THEN
    RAISE EXCEPTION 'sem permissão para criar implantação';
  END IF;
  IF nullif(trim(p_data->>'ownerId'), '') IS NULL THEN RAISE EXCEPTION 'proprietário obrigatório'; END IF;
  IF nullif(trim(p_data->>'condominiumName'), '') IS NULL THEN RAISE EXCEPTION 'condomínio obrigatório'; END IF;
  IF nullif(trim(p_data->>'unit'), '') IS NULL THEN RAISE EXCEPTION 'unidade obrigatória'; END IF;

  v_owner_id := (p_data->>'ownerId')::uuid;
  PERFORM pg_advisory_xact_lock(hashtext('implementation_code_sequence'));
  SELECT coalesce(max((regexp_match(code, '^IMP-([0-9]+)$'))[1]::integer), 0) + 1
  INTO v_sequence FROM public.implementation_projects;
  v_code := 'IMP-' || lpad(v_sequence::text, 5, '0');

  INSERT INTO public.implementation_projects (
    code, status, owner_id, condominium_id, condominium_name, tower, unit,
    address, city, responsible_user_id, notes, origin, cover_image
  ) VALUES (
    v_code, 'prospect', v_owner_id,
    nullif(p_data->>'condominiumId', '')::uuid, nullif(trim(p_data->>'condominiumName'), ''),
    nullif(trim(p_data->>'tower'), ''), nullif(trim(p_data->>'unit'), ''),
    nullif(trim(p_data->>'address'), ''), nullif(trim(p_data->>'city'), ''),
    nullif(p_data->>'responsibleUserId', '')::uuid, nullif(trim(p_data->>'notes'), ''),
    'admin_quick_create', nullif(trim(p_data->>'coverImage'), '')
  ) RETURNING * INTO v_project;

  INSERT INTO public.implementation_owners (implementation_id, owner_id, role, display_order, address)
  VALUES (v_project.id, v_owner_id, 'proprietario', 0, nullif(trim(p_data->>'ownerAddress'), ''))
  ON CONFLICT DO NOTHING;

  IF jsonb_typeof(p_data->'additionalOwners') = 'array' THEN
    FOR v_owner IN SELECT value FROM jsonb_array_elements(p_data->'additionalOwners') LOOP
      IF nullif(v_owner->>'ownerId', '') IS NOT NULL THEN
        INSERT INTO public.implementation_owners (implementation_id, owner_id, role, display_order, address)
        VALUES (
          v_project.id,
          (v_owner->>'ownerId')::uuid,
          coalesce(nullif(trim(v_owner->>'role'), ''), 'coproprietario'),
          v_order,
          nullif(trim(v_owner->>'address'), '')
        )
        ON CONFLICT DO NOTHING;
        v_order := v_order + 1;
      END IF;
    END LOOP;
  END IF;

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