CREATE OR REPLACE FUNCTION public.is_valid_brazilian_document(p_value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g'); s integer; d1 integer; d2 integer; i integer; w integer[];
BEGIN
  IF v ~ '^(\d)\1+$' THEN RETURN false; END IF;
  IF length(v) = 11 THEN
    s := 0; FOR i IN 1..9 LOOP s := s + substring(v,i,1)::integer * (11-i); END LOOP;
    d1 := (s*10)%11; IF d1=10 THEN d1:=0; END IF;
    s := 0; FOR i IN 1..10 LOOP s := s + substring(v,i,1)::integer * (12-i); END LOOP;
    d2 := (s*10)%11; IF d2=10 THEN d2:=0; END IF;
    RETURN d1=substring(v,10,1)::integer AND d2=substring(v,11,1)::integer;
  ELSIF length(v) = 14 THEN
    w:=ARRAY[5,4,3,2,9,8,7,6,5,4,3,2]; s:=0;
    FOR i IN 1..12 LOOP s:=s+substring(v,i,1)::integer*w[i]; END LOOP;
    d1:=CASE WHEN s%11<2 THEN 0 ELSE 11-(s%11) END;
    w:=ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2]; s:=0;
    FOR i IN 1..12 LOOP s:=s+substring(v,i,1)::integer*w[i]; END LOOP;
    s:=s+d1*w[13]; d2:=CASE WHEN s%11<2 THEN 0 ELSE 11-(s%11) END;
    RETURN d1=substring(v,13,1)::integer AND d2=substring(v,14,1)::integer;
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.is_valid_brazilian_document(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.owner_onboarding_submit(p_token text,p_full_name text,p_document text,p_email text,p_phone text,p_pix_key text)
RETURNS public.owner_onboarding_submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_invitation public.owner_portal_invitations%rowtype; v_submission public.owner_onboarding_submissions%rowtype; v_name text:=regexp_replace(trim(coalesce(p_full_name,'')),'\s+',' ','g'); v_document text:=regexp_replace(coalesce(p_document,''),'\D','','g'); v_email text:=lower(trim(coalesce(p_email,''))); v_phone text:=regexp_replace(coalesce(p_phone,''),'\D','','g');
BEGIN
  IF length(v_name)<3 OR length(v_name)>120 THEN RAISE EXCEPTION 'nome inválido'; END IF;
  IF NOT public.is_valid_brazilian_document(v_document) THEN RAISE EXCEPTION 'CPF ou CNPJ inválido'; END IF;
  IF length(v_email)>255 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RAISE EXCEPTION 'e-mail inválido'; END IF;
  IF v_phone !~ '^(55)?[1-9][0-9][0-9]{8,9}$' THEN RAISE EXCEPTION 'telefone inválido'; END IF;
  IF v_phone !~ '^55' THEN v_phone:='55'||v_phone; END IF;
  SELECT * INTO v_invitation FROM public.owner_portal_invitations WHERE token_hash=encode(digest(p_token,'sha256'),'hex') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'convite não encontrado'; END IF;
  IF v_invitation.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'convite revogado'; END IF;
  IF v_invitation.used_at IS NOT NULL THEN RAISE EXCEPTION 'convite já usado'; END IF;
  IF v_invitation.expires_at<now() THEN RAISE EXCEPTION 'convite expirado'; END IF;
  UPDATE public.owner_portal_invitations SET used_at=now() WHERE id=v_invitation.id;
  INSERT INTO public.owner_onboarding_submissions(implementation_id,full_name,document,email,phone,pix_key)
  VALUES(v_invitation.implementation_id,v_name,v_document,v_email,v_phone,nullif(trim(p_pix_key),'')) RETURNING * INTO v_submission;
  RETURN v_submission;
END $$;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_submit(text,text,text,text,text,text) TO anon, authenticated;