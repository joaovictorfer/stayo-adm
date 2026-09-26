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
  v_bank_branch text;
  v_account_number text;
  v_account_type text;
  v_owner public.owner_records%rowtype;
  v_prefilled boolean := false;
BEGIN
  v_base := public.owner_onboarding_draft_resolve(p_token);
  IF v_base IS NULL THEN RETURN NULL; END IF;

  SELECT implementation_id INTO v_implementation_id
  FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND revoked_at IS NULL
    AND expires_at >= now()
  LIMIT 1;
  IF v_implementation_id IS NULL THEN RETURN NULL; END IF;

  SELECT bank_branch, account_number, account_type
  INTO v_bank_branch, v_account_number, v_account_type
  FROM public.owner_payout_accounts
  WHERE implementation_id = v_implementation_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'role', role, 'personType', person_type, 'fullName', full_name,
    'document', document, 'email', email, 'phone', phone
  ) ORDER BY position), '[]'::jsonb)
  INTO v_people
  FROM public.owner_onboarding_people
  WHERE implementation_id = v_implementation_id;

  IF jsonb_array_length(v_people) = 0 AND coalesce(v_base->>'legalName', '') <> '' THEN
    v_people := jsonb_build_array(jsonb_build_object(
      'role', 'proprietario',
      'personType', coalesce(v_base->>'personType', 'pf'),
      'fullName', v_base->>'legalName', 'document', v_base->>'taxId',
      'email', v_base->>'email', 'phone', v_base->>'phone'
    ));
  END IF;

  -- Pré-preenchimento com o contato que a STAYO já registrou (só dados de contato; nada interno).
  IF jsonb_array_length(v_people) = 0 AND coalesce(v_base->>'legalName', '') = '' THEN
    SELECT o.* INTO v_owner FROM public.owner_records o
    JOIN public.implementation_projects ip ON ip.owner_id = o.id
    WHERE ip.id = v_implementation_id;
    IF FOUND AND coalesce(v_owner.name, '') <> '' THEN
      v_prefilled := true;
      v_people := jsonb_build_array(jsonb_build_object(
        'role', 'proprietario', 'personType', 'pf', 'fullName', v_owner.name,
        'document', coalesce(v_owner.document, ''), 'email', coalesce(v_owner.email, ''),
        'phone', coalesce(v_owner.phone, '')
      ));
      v_base := v_base || jsonb_build_object(
        'legalName', v_owner.name, 'taxId', v_owner.document,
        'email', v_owner.email, 'phone', v_owner.phone
      );
    END IF;
  END IF;

  RETURN v_base || jsonb_build_object(
    'people', v_people,
    'bankBranch', v_bank_branch,
    'accountNumber', v_account_number,
    'accountType', v_account_type,
    'prefilledByStayo', v_prefilled
  );
END;
$function$;