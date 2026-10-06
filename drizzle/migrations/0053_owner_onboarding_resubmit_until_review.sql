CREATE OR REPLACE FUNCTION public.owner_onboarding_locked(p_impl uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  -- Cadastro enviado pode ser corrigido e reenviado até a STAYO concluir a revisão
  -- (implantação pronta para operação ou ativa).
  SELECT EXISTS (SELECT 1 FROM public.implementation_projects
                 WHERE id = p_impl AND status IN ('pronto_para_operacao','ativo','cancelado','nao_convertido'));
$$;
REVOKE ALL ON FUNCTION public.owner_onboarding_locked(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_link_write_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  IF public.owner_onboarding_locked(v_impl) THEN
    RAISE EXCEPTION 'cadastro já revisado pela STAYO; solicite a correção';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $function$;

CREATE OR REPLACE FUNCTION public.owner_property_details_save_by_token(p_token text, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_id uuid; p public.implementation_projects%rowtype; k text; v jsonb; current_data jsonb; expected jsonb; n numeric; detail_patch jsonb:='{}'; project_patch jsonb:='{}';
BEGIN
  IF p_token IS NULL OR char_length(p_token)<32 OR char_length(p_token)>200 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT implementation_id INTO v_id FROM public.owner_portal_invitations WHERE token_hash=encode(digest(p_token,'sha256'),'hex') AND revoked_at IS NULL AND expires_at>=now() FOR UPDATE;
  IF v_id IS NULL THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  IF NOT public.owner_journey_current_confirmed(v_id) THEN RAISE EXCEPTION 'confirme as condições da proposta antes do cadastro'; END IF;
  IF public.owner_onboarding_locked(v_id) THEN RAISE EXCEPTION 'cadastro já revisado pela STAYO; solicite a correção'; END IF;
  SELECT * INTO p FROM public.implementation_projects WHERE id=v_id FOR UPDATE;
  PERFORM 1 FROM public.implementation_property_details WHERE implementation_id=v_id FOR UPDATE;
  current_data:=public.owner_property_details_resolve_by_token(p_token); expected:=p_data->'_expected';
  FOR k,v IN SELECT key,value FROM jsonb_each(p_data) LOOP
    IF k='_expected' THEN CONTINUE; END IF;
    IF k NOT IN ('propertyCondominiumName','propertyUnit','propertyParkingBox','propertyBedrooms','propertyBathrooms','propertySuites','propertyLavatories') THEN CONTINUE; END IF;
    IF jsonb_typeof(expected) IS DISTINCT FROM 'object' OR NOT expected ? k OR (expected->k) IS DISTINCT FROM (current_data->k) THEN RAISE EXCEPTION 'Este dado foi atualizado pela STAYO. Recarregue para conferir antes de corrigir.' USING ERRCODE='40001'; END IF;
    IF k='propertyCondominiumName' AND p.condominium_id IS NOT NULL THEN RAISE EXCEPTION 'Condomínio vinculado: solicite a correção à STAYO'; END IF;
    IF k IN ('propertyBedrooms','propertyBathrooms','propertySuites','propertyLavatories') THEN
      IF v<>'null'::jsonb THEN
        IF jsonb_typeof(v)<>'number' THEN RAISE EXCEPTION 'quantidade inválida'; END IF;
        n:=(v#>>'{}')::numeric;
        IF n<>trunc(n) OR n<0 OR n>30 THEN RAISE EXCEPTION 'quantidade inválida'; END IF;
      END IF;
    ELSE
      IF v<>'null'::jsonb AND (jsonb_typeof(v)<>'string' OR char_length(v#>>'{}')>160) THEN RAISE EXCEPTION 'texto inválido'; END IF;
      v:=coalesce(to_jsonb(nullif(trim(v#>>'{}'),'')),'null'::jsonb);
    END IF;
    IF v IS NOT DISTINCT FROM current_data->k THEN CONTINUE; END IF;
    CASE k WHEN 'propertyUnit' THEN project_patch:=project_patch||jsonb_build_object('unit',v);
    WHEN 'propertyCondominiumName' THEN project_patch:=project_patch||jsonb_build_object('condominium_name',v);
    WHEN 'propertyBedrooms' THEN project_patch:=project_patch||jsonb_build_object('bedrooms',v);
    WHEN 'propertyParkingBox' THEN detail_patch:=detail_patch||jsonb_build_object('parking_box',v);
    WHEN 'propertyBathrooms' THEN detail_patch:=detail_patch||jsonb_build_object('bathrooms',v);
    WHEN 'propertySuites' THEN detail_patch:=detail_patch||jsonb_build_object('suites',v);
    WHEN 'propertyLavatories' THEN detail_patch:=detail_patch||jsonb_build_object('lavatories',v); END CASE;
  END LOOP;
  FOR k,v IN SELECT key,value FROM jsonb_each(project_patch) LOOP
    IF k='bedrooms' THEN UPDATE public.implementation_projects SET bedrooms=(v#>>'{}')::integer WHERE id=v_id;
    ELSIF k='unit' THEN UPDATE public.implementation_projects SET unit=v#>>'{}' WHERE id=v_id;
    ELSIF k='condominium_name' THEN UPDATE public.implementation_projects SET condominium_name=v#>>'{}' WHERE id=v_id; END IF;
  END LOOP;
  IF detail_patch<>'{}'::jsonb THEN
    INSERT INTO public.implementation_property_details(implementation_id) VALUES(v_id) ON CONFLICT DO NOTHING;
    FOR k,v IN SELECT key,value FROM jsonb_each(detail_patch) LOOP
      IF k='parking_box' THEN UPDATE public.implementation_property_details SET parking_box=v#>>'{}',updated_at=now() WHERE implementation_id=v_id;
      ELSE EXECUTE format('UPDATE public.implementation_property_details SET %I=$1, updated_at=now() WHERE implementation_id=$2',k) USING (v#>>'{}')::integer,v_id; END IF;
    END LOOP;
  END IF;
  RETURN public.owner_property_details_resolve_by_token(p_token);
END $function$;