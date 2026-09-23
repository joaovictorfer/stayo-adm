CREATE OR REPLACE FUNCTION public.owner_property_details_resolve_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_implementation_id uuid;
  v_details public.implementation_property_details%rowtype;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN RETURN NULL; END IF;
  SELECT implementation_id INTO v_implementation_id
  FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND revoked_at IS NULL AND expires_at >= now()
  LIMIT 1;
  IF v_implementation_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_details FROM public.implementation_property_details WHERE implementation_id = v_implementation_id;
  RETURN jsonb_build_object(
    'propertyPostalCode', v_details.postal_code, 'propertyStreet', v_details.street,
    'propertyNumber', v_details.number, 'propertyComplement', v_details.complement,
    'propertyDistrict', v_details.district, 'propertyCity', v_details.city,
    'propertyState', v_details.state, 'propertyType', v_details.property_type,
    'propertyBedrooms', v_details.bedrooms, 'propertySuites', v_details.suites,
    'propertyBathrooms', v_details.bathrooms, 'propertyParkingSpots', v_details.parking_spots,
    'propertyAccessType', v_details.access_type, 'propertyAccessNotes', v_details.access_notes,
    'propertyAccessCode', v_details.access_code, 'propertyWifiNetwork', v_details.wifi_network,
    'propertyWifiPassword', v_details.wifi_password
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_property_details_save_by_token(p_token text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_implementation_id uuid;
  v_access_type text := nullif(trim(p_data->>'propertyAccessType'), '');
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT implementation_id INTO v_implementation_id
  FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND revoked_at IS NULL AND expires_at >= now()
  FOR UPDATE;
  IF v_implementation_id IS NULL THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  IF v_access_type IS NOT NULL AND v_access_type NOT IN ('key','lock','concierge','other') THEN RAISE EXCEPTION 'forma de acesso inválida'; END IF;
  INSERT INTO public.implementation_property_details (
    implementation_id, postal_code, street, number, complement, district, city, state,
    property_type, bedrooms, suites, bathrooms, parking_spots, access_type, access_notes,
    access_code, wifi_network, wifi_password, updated_at
  ) VALUES (
    v_implementation_id,
    nullif(regexp_replace(coalesce(p_data->>'propertyPostalCode',''), '[^0-9]', '', 'g'), ''),
    nullif(trim(p_data->>'propertyStreet'), ''), nullif(trim(p_data->>'propertyNumber'), ''),
    nullif(trim(p_data->>'propertyComplement'), ''), nullif(trim(p_data->>'propertyDistrict'), ''),
    nullif(trim(p_data->>'propertyCity'), ''), upper(nullif(trim(p_data->>'propertyState'), '')),
    nullif(trim(p_data->>'propertyType'), ''), nullif(p_data->>'propertyBedrooms','')::integer,
    nullif(p_data->>'propertySuites','')::integer, nullif(p_data->>'propertyBathrooms','')::integer,
    nullif(p_data->>'propertyParkingSpots','')::integer, v_access_type,
    nullif(trim(p_data->>'propertyAccessNotes'), ''), nullif(trim(p_data->>'propertyAccessCode'), ''),
    nullif(trim(p_data->>'propertyWifiNetwork'), ''), nullif(trim(p_data->>'propertyWifiPassword'), ''), now()
  )
  ON CONFLICT (implementation_id) DO UPDATE SET
    postal_code=excluded.postal_code, street=excluded.street, number=excluded.number,
    complement=excluded.complement, district=excluded.district, city=excluded.city, state=excluded.state,
    property_type=excluded.property_type, bedrooms=excluded.bedrooms, suites=excluded.suites,
    bathrooms=excluded.bathrooms, parking_spots=excluded.parking_spots,
    access_type=excluded.access_type, access_notes=excluded.access_notes, access_code=excluded.access_code,
    wifi_network=excluded.wifi_network, wifi_password=excluded.wifi_password, updated_at=now();
  RETURN public.owner_property_details_resolve_by_token(p_token);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_property_details_resolve_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_property_details_save_by_token(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_property_details_resolve_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_property_details_save_by_token(text, jsonb) TO anon, authenticated;