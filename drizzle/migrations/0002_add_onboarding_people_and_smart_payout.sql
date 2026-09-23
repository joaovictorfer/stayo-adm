CREATE TABLE public.owner_onboarding_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  role text NOT NULL DEFAULT 'proprietario' CHECK (role IN ('proprietario','coproprietario','proponente')),
  person_type text NOT NULL DEFAULT 'pf' CHECK (person_type IN ('pf','pj')),
  full_name text,
  document text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (implementation_id, position)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_onboarding_people TO authenticated;
GRANT ALL ON public.owner_onboarding_people TO service_role;

ALTER TABLE public.owner_onboarding_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time interno le pessoas do cadastro"
ON public.owner_onboarding_people FOR SELECT TO authenticated
USING (public.has_admin_role(VARIADIC ARRAY['super_admin'::public.admin_role,'admin'::public.admin_role,'commercial'::public.admin_role,'operations'::public.admin_role,'finance'::public.admin_role,'viewer'::public.admin_role]));

CREATE POLICY "admin e comercial gerenciam pessoas do cadastro"
ON public.owner_onboarding_people FOR ALL TO authenticated
USING (public.has_admin_role(VARIADIC ARRAY['super_admin'::public.admin_role,'admin'::public.admin_role,'commercial'::public.admin_role]))
WITH CHECK (public.has_admin_role(VARIADIC ARRAY['super_admin'::public.admin_role,'admin'::public.admin_role,'commercial'::public.admin_role]));

CREATE TRIGGER owner_onboarding_people_set_updated_at
BEFORE UPDATE ON public.owner_onboarding_people
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.owner_onboarding_draft_resolve_v2(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_base jsonb;
  v_implementation_id uuid;
  v_people jsonb;
BEGIN
  v_base := public.owner_onboarding_draft_resolve(p_token);
  IF v_base IS NULL THEN RETURN NULL; END IF;

  SELECT implementation_id INTO v_implementation_id
  FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND revoked_at IS NULL AND expires_at >= now()
  LIMIT 1;
  IF v_implementation_id IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'role', role,
    'personType', person_type,
    'fullName', full_name,
    'document', document,
    'email', email,
    'phone', phone
  ) ORDER BY position), '[]'::jsonb)
  INTO v_people
  FROM public.owner_onboarding_people
  WHERE implementation_id = v_implementation_id;

  IF jsonb_array_length(v_people) = 0 AND coalesce(v_base->>'legalName','') <> '' THEN
    v_people := jsonb_build_array(jsonb_build_object(
      'role','proprietario', 'personType',coalesce(v_base->>'personType','pf'),
      'fullName',v_base->>'legalName', 'document',v_base->>'taxId',
      'email',v_base->>'email', 'phone',v_base->>'phone'
    ));
  END IF;
  RETURN v_base || jsonb_build_object('people', v_people);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_onboarding_draft_save_v2(p_token text, p_data jsonb, p_submit boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_result jsonb;
  v_invitation public.owner_portal_invitations%rowtype;
  v_person jsonb;
  v_position integer := 0;
  v_name text;
  v_document text;
  v_email text;
  v_phone text;
  v_person_type text;
  v_role text;
BEGIN
  IF jsonb_typeof(p_data->'people') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'people') < 1 OR jsonb_array_length(p_data->'people') > 10 THEN
    RAISE EXCEPTION 'informe entre 1 e 10 proprietários ou proponentes';
  END IF;

  SELECT * INTO v_invitation FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token,'sha256'),'hex') FOR UPDATE;
  IF NOT FOUND OR v_invitation.revoked_at IS NOT NULL OR v_invitation.expires_at < now() THEN RAISE EXCEPTION 'acesso inválido'; END IF;

  v_result := public.owner_onboarding_draft_save(p_token, p_data, p_submit);
  DELETE FROM public.owner_onboarding_people WHERE implementation_id = v_invitation.implementation_id;

  FOR v_person IN SELECT value FROM jsonb_array_elements(p_data->'people') LOOP
    v_person_type := coalesce(nullif(trim(v_person->>'personType'),''),'pf');
    v_role := CASE WHEN v_position = 0 THEN 'proprietario' ELSE coalesce(nullif(trim(v_person->>'role'),''),'coproprietario') END;
    v_name := nullif(regexp_replace(trim(coalesce(v_person->>'fullName','')),'\s+',' ','g'),'');
    v_document := regexp_replace(coalesce(v_person->>'document',''),'\D','','g');
    v_email := lower(nullif(trim(v_person->>'email'),''));
    v_phone := regexp_replace(coalesce(v_person->>'phone',''),'\D','','g');
    IF v_phone !~ '^55' AND length(v_phone) IN (10,11) THEN v_phone := '55'||v_phone; END IF;

    IF v_person_type NOT IN ('pf','pj') OR v_role NOT IN ('proprietario','coproprietario','proponente') THEN RAISE EXCEPTION 'dados do proprietário inválidos'; END IF;
    IF p_submit AND (v_name IS NULL OR NOT public.is_valid_brazilian_document(v_document)) THEN RAISE EXCEPTION 'nome ou CPF/CNPJ de proprietário inválido'; END IF;
    IF p_submit AND v_email IS NOT NULL AND v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN RAISE EXCEPTION 'e-mail de proprietário inválido'; END IF;
    IF p_submit AND v_phone <> '' AND v_phone !~ '^55[1-9][0-9][0-9]{8,9}$' THEN RAISE EXCEPTION 'telefone de proprietário inválido'; END IF;

    INSERT INTO public.owner_onboarding_people(implementation_id,position,role,person_type,full_name,document,email,phone)
    VALUES(v_invitation.implementation_id,v_position,v_role,v_person_type,v_name,nullif(v_document,''),v_email,nullif(v_phone,''));
    v_position := v_position + 1;
  END LOOP;

  RETURN public.owner_onboarding_draft_resolve_v2(p_token);
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_onboarding_draft_resolve_v2(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_onboarding_draft_save_v2(text,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_resolve_v2(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_save_v2(text,jsonb,boolean) TO anon, authenticated;