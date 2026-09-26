CREATE OR REPLACE FUNCTION public.owner_journey_current_confirmed(p_implementation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cur AS (
    SELECT id FROM public.proposals
    WHERE implementation_id = p_implementation_id
      AND status IN ('published','accepted') AND snapshot IS NOT NULL
    ORDER BY version DESC LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1 FROM cur JOIN public.owner_proposal_confirmations c
      ON c.proposal_id = cur.id AND c.result = 'confirmed'
  );
$$;
REVOKE ALL ON FUNCTION public.owner_journey_current_confirmed(uuid) FROM PUBLIC, anon;

-- Gravações feitas pelo link público (papel anon): exigem confirmação da versão
-- vigente e bloqueiam alterações depois do envio para análise.
CREATE OR REPLACE FUNCTION public.owner_link_write_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_impl uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'anon' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_impl := CASE WHEN TG_OP = 'DELETE' THEN OLD.implementation_id ELSE NEW.implementation_id END;
  IF NOT public.owner_journey_current_confirmed(v_impl) THEN
    RAISE EXCEPTION 'confirme as condições da proposta antes do cadastro';
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_onboarding_profiles p
             WHERE p.implementation_id = v_impl AND p.submitted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'cadastro já enviado para análise';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER owner_link_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.owner_onboarding_profiles
  FOR EACH ROW EXECUTE FUNCTION public.owner_link_write_guard();
CREATE TRIGGER owner_link_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.owner_onboarding_people
  FOR EACH ROW EXECUTE FUNCTION public.owner_link_write_guard();
CREATE TRIGGER owner_link_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.owner_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.owner_link_write_guard();
CREATE TRIGGER owner_link_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.implementation_property_details
  FOR EACH ROW EXECUTE FUNCTION public.owner_link_write_guard();

-- O link de implantação não coleta nem devolve acesso/Wi-Fi: não apaga o que a
-- equipe cadastrou e não expõe esses valores a quem tem só o link.
CREATE OR REPLACE FUNCTION public.owner_property_details_resolve_by_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
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
    'propertyBathrooms', v_details.bathrooms, 'propertyParkingSpots', v_details.parking_spots
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_property_details_save_by_token(p_token text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
DECLARE
  v_implementation_id uuid;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT implementation_id INTO v_implementation_id
  FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND revoked_at IS NULL AND expires_at >= now()
  FOR UPDATE;
  IF v_implementation_id IS NULL THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  INSERT INTO public.implementation_property_details (
    implementation_id, postal_code, street, number, complement, district, city, state,
    property_type, bedrooms, suites, bathrooms, parking_spots, updated_at
  ) VALUES (
    v_implementation_id,
    nullif(regexp_replace(coalesce(p_data->>'propertyPostalCode',''), '[^0-9]', '', 'g'), ''),
    nullif(trim(p_data->>'propertyStreet'), ''), nullif(trim(p_data->>'propertyNumber'), ''),
    nullif(trim(p_data->>'propertyComplement'), ''), nullif(trim(p_data->>'propertyDistrict'), ''),
    nullif(trim(p_data->>'propertyCity'), ''), upper(nullif(trim(p_data->>'propertyState'), '')),
    nullif(trim(p_data->>'propertyType'), ''), nullif(p_data->>'propertyBedrooms','')::integer,
    nullif(p_data->>'propertySuites','')::integer, nullif(p_data->>'propertyBathrooms','')::integer,
    nullif(p_data->>'propertyParkingSpots','')::integer, now()
  )
  ON CONFLICT (implementation_id) DO UPDATE SET
    postal_code=excluded.postal_code, street=excluded.street, number=excluded.number,
    complement=excluded.complement, district=excluded.district, city=excluded.city, state=excluded.state,
    property_type=excluded.property_type, bedrooms=excluded.bedrooms, suites=excluded.suites,
    bathrooms=excluded.bathrooms, parking_spots=excluded.parking_spots, updated_at=now();
  RETURN public.owner_property_details_resolve_by_token(p_token);
END;
$function$;