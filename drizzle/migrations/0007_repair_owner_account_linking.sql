CREATE OR REPLACE FUNCTION public.owner_account_link(p_token text)
RETURNS public.owner_portal_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_invitation public.owner_portal_invitations%rowtype;
  v_profile public.owner_onboarding_profiles%rowtype;
  v_account public.owner_portal_accounts%rowtype;
  v_owner_id uuid;
  v_auth_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'precisa estar autenticado';
  END IF;

  SELECT * INTO v_invitation
  FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'convite não encontrado'; END IF;
  IF v_invitation.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'convite revogado'; END IF;
  IF v_invitation.expires_at < now() THEN RAISE EXCEPTION 'convite expirado'; END IF;

  SELECT * INTO v_profile
  FROM public.owner_onboarding_profiles
  WHERE implementation_id = v_invitation.implementation_id;

  IF NOT FOUND OR v_profile.submitted_at IS NULL THEN
    RAISE EXCEPTION 'cadastro ainda não foi finalizado';
  END IF;

  v_auth_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  IF v_auth_email IS NULL OR v_profile.email IS NULL OR v_auth_email <> lower(trim(v_profile.email)) THEN
    RAISE EXCEPTION 'entre com o mesmo e-mail informado no cadastro';
  END IF;

  SELECT * INTO v_account
  FROM public.owner_portal_accounts
  WHERE id = auth.uid();

  IF FOUND THEN
    IF v_invitation.owner_id IS NOT NULL AND v_account.owner_id <> v_invitation.owner_id THEN
      RAISE EXCEPTION 'esta conta já está vinculada a outro proprietário';
    END IF;
    RETURN v_account;
  END IF;

  v_owner_id := v_invitation.owner_id;
  IF v_owner_id IS NULL THEN
    INSERT INTO public.owner_records (name, phone, email, document, lifecycle_status)
    VALUES (
      coalesce(nullif(trim(v_profile.legal_name), ''), 'Proprietário'),
      nullif(regexp_replace(coalesce(v_profile.phone, ''), '[^0-9]', '', 'g'), ''),
      lower(nullif(trim(v_profile.email), '')),
      nullif(regexp_replace(coalesce(v_profile.tax_id, ''), '[^0-9]', '', 'g'), ''),
      'prospect'
    )
    RETURNING id INTO v_owner_id;

    UPDATE public.owner_portal_invitations
    SET owner_id = v_owner_id
    WHERE implementation_id = v_invitation.implementation_id
      AND owner_id IS NULL;

    UPDATE public.implementation_projects
    SET owner_id = v_owner_id
    WHERE id = v_invitation.implementation_id
      AND owner_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.owner_portal_accounts
    WHERE owner_id = v_owner_id AND id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'este proprietário já possui outra conta de acesso';
  END IF;

  INSERT INTO public.owner_portal_accounts (id, owner_id)
  VALUES (auth.uid(), v_owner_id)
  RETURNING * INTO v_account;

  RETURN v_account;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_account_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_account_link(text) TO authenticated;