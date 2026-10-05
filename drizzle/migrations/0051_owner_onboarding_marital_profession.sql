-- see body below
ALTER TABLE public.owner_onboarding_people
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS profession text;
COMMENT ON COLUMN public.owner_onboarding_people.marital_status IS 'Estado civil informado pelo proprietário/proponente (nullable para dados antigos).';
COMMENT ON COLUMN public.owner_onboarding_people.profession IS 'Profissão informada pelo proprietário/proponente (nullable para dados antigos).';

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
    AND revoked_at IS NULL AND expires_at >= now()
  LIMIT 1;
  IF v_implementation_id IS NULL THEN RETURN NULL; END IF;
  SELECT bank_branch, account_number, account_type
  INTO v_bank_branch, v_account_number, v_account_type
  FROM public.owner_payout_accounts WHERE implementation_id = v_implementation_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'role', role, 'personType', person_type, 'fullName', full_name,
    'document', document, 'email', email, 'phone', phone,
    'maritalStatus', marital_status, 'profession', profession
  ) ORDER BY position), '[]'::jsonb)
  INTO v_people FROM public.owner_onboarding_people WHERE implementation_id = v_implementation_id;
  IF jsonb_array_length(v_people) = 0 AND coalesce(v_base->>'legalName', '') <> '' THEN
    v_people := jsonb_build_array(jsonb_build_object(
      'role', 'proprietario', 'personType', coalesce(v_base->>'personType', 'pf'),
      'fullName', v_base->>'legalName', 'document', v_base->>'taxId',
      'email', v_base->>'email', 'phone', v_base->>'phone'));
  END IF;
  IF jsonb_array_length(v_people) = 0 AND coalesce(v_base->>'legalName', '') = '' THEN
    SELECT o.* INTO v_owner FROM public.owner_records o
    JOIN public.implementation_projects ip ON ip.owner_id = o.id WHERE ip.id = v_implementation_id;
    IF FOUND AND coalesce(v_owner.name, '') <> '' THEN
      v_prefilled := true;
      v_people := jsonb_build_array(jsonb_build_object(
        'role', 'proprietario', 'personType', 'pf', 'fullName', v_owner.name,
        'document', coalesce(v_owner.document, ''), 'email', coalesce(v_owner.email, ''),
        'phone', coalesce(v_owner.phone, '')));
      v_base := v_base || jsonb_build_object('legalName', v_owner.name, 'taxId', v_owner.document,
        'email', v_owner.email, 'phone', v_owner.phone);
    END IF;
  END IF;
  RETURN v_base || jsonb_build_object('people', v_people, 'bankBranch', v_bank_branch,
    'accountNumber', v_account_number, 'accountType', v_account_type, 'prefilledByStayo', v_prefilled);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_onboarding_draft_save_v2(p_token text, p_data jsonb, p_submit boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_invitation public.owner_portal_invitations%rowtype;
  v_person jsonb;
  v_position integer := 0;
  v_person_type text := nullif(trim(p_data->>'personType'), '');
  v_legal_name text := nullif(regexp_replace(trim(coalesce(p_data->>'legalName', p_data->>'fullName', '')), '[[:space:]]+', ' ', 'g'), '');
  v_tax_id text := regexp_replace(coalesce(p_data->>'taxId', p_data->>'document', ''), '[^0-9]', '', 'g');
  v_email text := lower(nullif(trim(p_data->>'email'), ''));
  v_phone text := regexp_replace(coalesce(p_data->>'phone', ''), '[^0-9]', '', 'g');
  v_postal text := regexp_replace(coalesce(p_data->>'postalCode', ''), '[^0-9]', '', 'g');
  v_state text := upper(nullif(trim(p_data->>'state'), ''));
  v_step integer := greatest(1, least(5, coalesce((p_data->>'currentStep')::integer, 1)));
  v_bank text := nullif(trim(p_data->>'bankName'), '');
  v_branch text := nullif(trim(p_data->>'bankBranch'), '');
  v_account text := nullif(trim(p_data->>'accountNumber'), '');
  v_account_type text := nullif(trim(p_data->>'accountType'), '');
  v_holder text := nullif(regexp_replace(trim(coalesce(p_data->>'accountHolder', '')), '[[:space:]]+', ' ', 'g'), '');
  v_holder_tax text := regexp_replace(coalesce(p_data->>'holderTaxId', ''), '[^0-9]', '', 'g');
  v_pix_type text := nullif(trim(p_data->>'pixType'), '');
  v_pix_key text := nullif(trim(p_data->>'pixKey'), '');
  v_name text; v_document text; v_person_email text; v_person_phone text;
  v_item_type text; v_role text; v_marital text; v_profession text;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'dados inválidos';
  END IF;
  IF jsonb_typeof(p_data->'people') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'people') < 1 OR jsonb_array_length(p_data->'people') > 10 THEN
    RAISE EXCEPTION 'informe entre 1 e 10 proprietários ou proponentes';
  END IF;
  SELECT * INTO v_invitation FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') FOR UPDATE;
  IF NOT FOUND OR v_invitation.revoked_at IS NOT NULL OR v_invitation.expires_at < now() THEN
    RAISE EXCEPTION 'acesso inválido';
  END IF;
  INSERT INTO public.implementation_projects (id, code, status, nickname, owner_id, origin)
  VALUES (v_invitation.implementation_id,
    'IMP-LINK-' || upper(substr(replace(v_invitation.implementation_id::text, '-', ''), 1, 8)),
    'prospect', nullif(v_invitation.public_snapshot->>'propertyLabel', ''), v_invitation.owner_id, 'owner_portal_link')
  ON CONFLICT (id) DO NOTHING;

  IF v_phone !~ '^55' AND length(v_phone) IN (10, 11) THEN v_phone := '55' || v_phone; END IF;
  IF v_person_type IS NOT NULL AND v_person_type NOT IN ('pf', 'pj') THEN RAISE EXCEPTION 'tipo inválido'; END IF;
  IF v_pix_type IS NOT NULL AND v_pix_type NOT IN ('cpf', 'cnpj', 'phone', 'email', 'random') THEN RAISE EXCEPTION 'tipo pix inválido'; END IF;
  IF v_account_type IS NOT NULL AND v_account_type NOT IN ('checking', 'savings', 'payment') THEN RAISE EXCEPTION 'tipo de conta inválido'; END IF;
  IF char_length(coalesce(v_legal_name, '')) > 160 OR char_length(coalesce(v_email, '')) > 255 OR char_length(coalesce(v_phone, '')) > 13 OR char_length(coalesce(v_pix_key, '')) > 255 THEN
    RAISE EXCEPTION 'campo excede o limite';
  END IF;

  IF p_submit THEN
    -- Endereço e tipo de pessoa não são exigidos para concluir o onboarding público.
    IF v_legal_name IS NULL OR v_email IS NULL OR v_bank IS NULL OR v_branch IS NULL OR v_account IS NULL OR v_account_type IS NULL OR v_holder IS NULL OR v_pix_type IS NULL OR v_pix_key IS NULL OR coalesce((p_data->>'confirmed')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'cadastro incompleto';
    END IF;
    IF NOT public.is_valid_brazilian_document(v_tax_id) OR NOT public.is_valid_brazilian_document(v_holder_tax) THEN RAISE EXCEPTION 'CPF ou CNPJ inválido'; END IF;
    IF (v_person_type = 'pf' AND length(v_tax_id) <> 11) OR (v_person_type = 'pj' AND length(v_tax_id) <> 14) THEN RAISE EXCEPTION 'documento incompatível com tipo de pessoa'; END IF;
    IF v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN RAISE EXCEPTION 'e-mail inválido'; END IF;
    IF v_phone !~ '^55[1-9][0-9][0-9]{8,9}$' THEN RAISE EXCEPTION 'telefone inválido'; END IF;
    IF v_postal <> '' AND length(v_postal) <> 8 THEN RAISE EXCEPTION 'CEP inválido'; END IF;
    IF v_state IS NOT NULL AND v_state !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'UF inválida'; END IF;
    IF v_pix_type = 'cpf' AND (length(regexp_replace(v_pix_key, '[^0-9]', '', 'g')) <> 11 OR NOT public.is_valid_brazilian_document(v_pix_key)) THEN RAISE EXCEPTION 'chave Pix CPF inválida'; END IF;
    IF v_pix_type = 'cnpj' AND (length(regexp_replace(v_pix_key, '[^0-9]', '', 'g')) <> 14 OR NOT public.is_valid_brazilian_document(v_pix_key)) THEN RAISE EXCEPTION 'chave Pix CNPJ inválida'; END IF;
  END IF;

  FOR v_person IN SELECT value FROM jsonb_array_elements(p_data->'people') LOOP
    v_item_type := coalesce(nullif(trim(v_person->>'personType'), ''), 'pf');
    v_role := CASE WHEN v_position = 0 THEN 'proprietario' ELSE coalesce(nullif(trim(v_person->>'role'), ''), 'coproprietario') END;
    v_name := nullif(regexp_replace(trim(coalesce(v_person->>'fullName', '')), '[[:space:]]+', ' ', 'g'), '');
    v_document := regexp_replace(coalesce(v_person->>'document', ''), '[^0-9]', '', 'g');
    v_person_email := lower(nullif(trim(v_person->>'email'), ''));
    v_person_phone := regexp_replace(coalesce(v_person->>'phone', ''), '[^0-9]', '', 'g');
    IF v_person_phone !~ '^55' AND length(v_person_phone) IN (10, 11) THEN v_person_phone := '55' || v_person_phone; END IF;
    IF v_item_type NOT IN ('pf', 'pj') OR v_role NOT IN ('proprietario', 'coproprietario', 'proponente') THEN RAISE EXCEPTION 'dados do proprietário inválidos'; END IF;
    IF char_length(coalesce(v_person->>'maritalStatus', '')) > 40 OR char_length(coalesce(v_person->>'profession', '')) > 120 THEN RAISE EXCEPTION 'campo excede o limite'; END IF;
    IF p_submit AND (v_name IS NULL OR NOT public.is_valid_brazilian_document(v_document)) THEN RAISE EXCEPTION 'nome ou CPF/CNPJ de proprietário inválido'; END IF;
    IF p_submit AND ((v_item_type = 'pf' AND length(v_document) <> 11) OR (v_item_type = 'pj' AND length(v_document) <> 14)) THEN RAISE EXCEPTION 'documento de proprietário incompatível com tipo de pessoa'; END IF;
    IF p_submit AND v_person_email IS NOT NULL AND v_person_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN RAISE EXCEPTION 'e-mail de proprietário inválido'; END IF;
    IF p_submit AND v_person_phone <> '' AND v_person_phone !~ '^55[1-9][0-9][0-9]{8,9}$' THEN RAISE EXCEPTION 'telefone de proprietário inválido'; END IF;
    v_position := v_position + 1;
  END LOOP;

  INSERT INTO public.owner_onboarding_profiles(implementation_id, person_type, legal_name, trade_name, tax_id, email, phone, postal_code, street, number, complement, district, city, state, current_step, submitted_at)
  VALUES(v_invitation.implementation_id, v_person_type, v_legal_name, nullif(trim(p_data->>'tradeName'), ''), nullif(v_tax_id, ''), v_email, nullif(v_phone, ''), nullif(v_postal, ''), nullif(trim(p_data->>'street'), ''), nullif(trim(p_data->>'number'), ''), nullif(trim(p_data->>'complement'), ''), nullif(trim(p_data->>'district'), ''), nullif(trim(p_data->>'city'), ''), v_state, v_step, CASE WHEN p_submit THEN now() ELSE NULL END)
  ON CONFLICT(implementation_id) DO UPDATE SET
    person_type=coalesce(excluded.person_type, owner_onboarding_profiles.person_type),
    legal_name=excluded.legal_name,
    trade_name=coalesce(excluded.trade_name, owner_onboarding_profiles.trade_name),
    tax_id=excluded.tax_id, email=excluded.email, phone=excluded.phone,
    postal_code=coalesce(excluded.postal_code, owner_onboarding_profiles.postal_code),
    street=coalesce(excluded.street, owner_onboarding_profiles.street),
    number=coalesce(excluded.number, owner_onboarding_profiles.number),
    complement=coalesce(excluded.complement, owner_onboarding_profiles.complement),
    district=coalesce(excluded.district, owner_onboarding_profiles.district),
    city=coalesce(excluded.city, owner_onboarding_profiles.city),
    state=coalesce(excluded.state, owner_onboarding_profiles.state),
    current_step=excluded.current_step,
    submitted_at=CASE WHEN p_submit THEN coalesce(owner_onboarding_profiles.submitted_at, now()) ELSE owner_onboarding_profiles.submitted_at END,
    updated_at=now();

  INSERT INTO public.owner_payout_accounts(implementation_id, bank_name, bank_branch, account_number, account_type, account_holder, holder_tax_id, pix_type, pix_key, is_primary)
  VALUES(v_invitation.implementation_id, v_bank, v_branch, v_account, v_account_type, v_holder, nullif(v_holder_tax, ''), v_pix_type, v_pix_key, coalesce((p_data->>'isPrimary')::boolean, true))
  ON CONFLICT(implementation_id) DO UPDATE SET bank_name=excluded.bank_name, bank_branch=excluded.bank_branch, account_number=excluded.account_number, account_type=excluded.account_type, account_holder=excluded.account_holder, holder_tax_id=excluded.holder_tax_id, pix_type=excluded.pix_type, pix_key=excluded.pix_key, is_primary=excluded.is_primary, updated_at=now();

  DELETE FROM public.owner_onboarding_people WHERE implementation_id = v_invitation.implementation_id;
  v_position := 0;
  FOR v_person IN SELECT value FROM jsonb_array_elements(p_data->'people') LOOP
    v_item_type := coalesce(nullif(trim(v_person->>'personType'), ''), 'pf');
    v_role := CASE WHEN v_position = 0 THEN 'proprietario' ELSE coalesce(nullif(trim(v_person->>'role'), ''), 'coproprietario') END;
    v_name := nullif(regexp_replace(trim(coalesce(v_person->>'fullName', '')), '[[:space:]]+', ' ', 'g'), '');
    v_document := regexp_replace(coalesce(v_person->>'document', ''), '[^0-9]', '', 'g');
    v_person_email := lower(nullif(trim(v_person->>'email'), ''));
    v_person_phone := regexp_replace(coalesce(v_person->>'phone', ''), '[^0-9]', '', 'g');
    v_marital := nullif(trim(coalesce(v_person->>'maritalStatus', '')), '');
    v_profession := nullif(regexp_replace(trim(coalesce(v_person->>'profession', '')), '[[:space:]]+', ' ', 'g'), '');
    IF v_person_phone !~ '^55' AND length(v_person_phone) IN (10, 11) THEN v_person_phone := '55' || v_person_phone; END IF;
    INSERT INTO public.owner_onboarding_people(implementation_id, position, role, person_type, full_name, document, email, phone, marital_status, profession)
    VALUES(v_invitation.implementation_id, v_position, v_role, v_item_type, v_name, nullif(v_document, ''), v_person_email, nullif(v_person_phone, ''), v_marital, v_profession);
    v_position := v_position + 1;
  END LOOP;

  UPDATE public.owner_portal_invitations SET last_access_at = now() WHERE id = v_invitation.id;
  RETURN public.owner_onboarding_draft_resolve_v2(p_token);
END;
$function$;