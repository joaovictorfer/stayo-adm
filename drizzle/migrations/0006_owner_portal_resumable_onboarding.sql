CREATE TABLE public.owner_onboarding_profiles (
  implementation_id uuid PRIMARY KEY REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  person_type text CHECK (person_type IN ('pf', 'pj')),
  legal_name text,
  trade_name text,
  tax_id text,
  email text,
  phone text,
  postal_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  current_step integer NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (legal_name IS NULL OR char_length(legal_name) <= 160),
  CHECK (trade_name IS NULL OR char_length(trade_name) <= 160),
  CHECK (tax_id IS NULL OR char_length(tax_id) <= 18),
  CHECK (email IS NULL OR char_length(email) <= 255),
  CHECK (phone IS NULL OR char_length(phone) <= 20),
  CHECK (postal_code IS NULL OR char_length(postal_code) <= 9),
  CHECK (street IS NULL OR char_length(street) <= 160),
  CHECK (number IS NULL OR char_length(number) <= 20),
  CHECK (complement IS NULL OR char_length(complement) <= 100),
  CHECK (district IS NULL OR char_length(district) <= 100),
  CHECK (city IS NULL OR char_length(city) <= 100),
  CHECK (state IS NULL OR char_length(state) <= 2)
);
GRANT SELECT, INSERT, UPDATE ON public.owner_onboarding_profiles TO authenticated;
GRANT ALL ON public.owner_onboarding_profiles TO service_role;
ALTER TABLE public.owner_onboarding_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin e comercial leem cadastro do portal"
  ON public.owner_onboarding_profiles FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin', 'admin', 'commercial'));
CREATE POLICY "admin e comercial gerenciam cadastro do portal"
  ON public.owner_onboarding_profiles FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin', 'admin', 'commercial'))
  WITH CHECK (public.has_admin_role('super_admin', 'admin', 'commercial'));

CREATE TABLE public.owner_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL UNIQUE REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  bank_name text,
  account_holder text,
  holder_tax_id text,
  pix_type text CHECK (pix_type IN ('cpf', 'cnpj', 'phone', 'email', 'random')),
  pix_key text,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (bank_name IS NULL OR char_length(bank_name) <= 120),
  CHECK (account_holder IS NULL OR char_length(account_holder) <= 160),
  CHECK (holder_tax_id IS NULL OR char_length(holder_tax_id) <= 18),
  CHECK (pix_key IS NULL OR char_length(pix_key) <= 255)
);
GRANT SELECT, INSERT, UPDATE ON public.owner_payout_accounts TO authenticated;
GRANT ALL ON public.owner_payout_accounts TO service_role;
ALTER TABLE public.owner_payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin e financeiro leem contas de repasse"
  ON public.owner_payout_accounts FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin', 'admin', 'finance'));
CREATE POLICY "admin e financeiro gerenciam contas de repasse"
  ON public.owner_payout_accounts FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin', 'admin', 'finance'))
  WITH CHECK (public.has_admin_role('super_admin', 'admin', 'finance'));

CREATE TRIGGER owner_onboarding_profiles_set_updated_at
  BEFORE UPDATE ON public.owner_onboarding_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER owner_payout_accounts_set_updated_at
  BEFORE UPDATE ON public.owner_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.owner_onboarding_draft_resolve(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invitation public.owner_portal_invitations%rowtype;
  v_profile public.owner_onboarding_profiles%rowtype;
  v_payout public.owner_payout_accounts%rowtype;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN RETURN NULL; END IF;
  SELECT * INTO v_invitation FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') LIMIT 1;
  IF NOT FOUND OR v_invitation.revoked_at IS NOT NULL OR v_invitation.expires_at < now() THEN RETURN NULL; END IF;
  SELECT * INTO v_profile FROM public.owner_onboarding_profiles WHERE implementation_id = v_invitation.implementation_id;
  SELECT * INTO v_payout FROM public.owner_payout_accounts WHERE implementation_id = v_invitation.implementation_id;
  RETURN jsonb_build_object(
    'personType', v_profile.person_type, 'legalName', v_profile.legal_name,
    'tradeName', v_profile.trade_name, 'taxId', v_profile.tax_id,
    'email', v_profile.email, 'phone', v_profile.phone,
    'postalCode', v_profile.postal_code, 'street', v_profile.street,
    'number', v_profile.number, 'complement', v_profile.complement,
    'district', v_profile.district, 'city', v_profile.city, 'state', v_profile.state,
    'currentStep', coalesce(v_profile.current_step, 1), 'submittedAt', v_profile.submitted_at,
    'bankName', v_payout.bank_name, 'accountHolder', v_payout.account_holder,
    'holderTaxId', v_payout.holder_tax_id, 'pixType', v_payout.pix_type,
    'pixKey', v_payout.pix_key, 'isPrimary', coalesce(v_payout.is_primary, true)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.owner_onboarding_draft_resolve(text) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_resolve(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_onboarding_draft_save(p_token text, p_data jsonb, p_submit boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invitation public.owner_portal_invitations%rowtype;
  v_person_type text := nullif(trim(p_data->>'personType'), '');
  v_legal_name text := nullif(trim(p_data->>'legalName'), '');
  v_trade_name text := nullif(trim(p_data->>'tradeName'), '');
  v_tax_id text := regexp_replace(coalesce(p_data->>'taxId', ''), '[^0-9]', '', 'g');
  v_email text := lower(nullif(trim(p_data->>'email'), ''));
  v_phone text := regexp_replace(coalesce(p_data->>'phone', ''), '[^0-9]', '', 'g');
  v_postal text := regexp_replace(coalesce(p_data->>'postalCode', ''), '[^0-9]', '', 'g');
  v_state text := upper(nullif(trim(p_data->>'state'), ''));
  v_step integer := greatest(1, least(5, coalesce((p_data->>'currentStep')::integer, 1)));
  v_bank text := nullif(trim(p_data->>'bankName'), '');
  v_holder text := nullif(trim(p_data->>'accountHolder'), '');
  v_holder_tax text := regexp_replace(coalesce(p_data->>'holderTaxId', ''), '[^0-9]', '', 'g');
  v_pix_type text := nullif(trim(p_data->>'pixType'), '');
  v_pix_key text := nullif(trim(p_data->>'pixKey'), '');
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 OR jsonb_typeof(p_data) <> 'object' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT * INTO v_invitation FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') FOR UPDATE;
  IF NOT FOUND OR v_invitation.revoked_at IS NOT NULL OR v_invitation.expires_at < now() THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  IF v_person_type IS NOT NULL AND v_person_type NOT IN ('pf', 'pj') THEN RAISE EXCEPTION 'tipo inválido'; END IF;
  IF char_length(coalesce(v_legal_name,'')) > 160 OR char_length(coalesce(v_trade_name,'')) > 160 OR char_length(coalesce(v_email,'')) > 255 OR char_length(coalesce(v_phone,'')) > 20 OR char_length(coalesce(v_pix_key,'')) > 255 THEN RAISE EXCEPTION 'campo excede o limite'; END IF;
  IF v_pix_type IS NOT NULL AND v_pix_type NOT IN ('cpf','cnpj','phone','email','random') THEN RAISE EXCEPTION 'tipo pix inválido'; END IF;
  IF p_submit THEN
    IF v_person_type IS NULL OR v_legal_name IS NULL OR v_tax_id = '' OR v_email IS NULL OR v_phone = '' OR v_postal = '' OR nullif(trim(p_data->>'street'),'') IS NULL OR nullif(trim(p_data->>'number'),'') IS NULL OR nullif(trim(p_data->>'district'),'') IS NULL OR nullif(trim(p_data->>'city'),'') IS NULL OR v_state IS NULL OR v_bank IS NULL OR v_holder IS NULL OR v_holder_tax = '' OR v_pix_type IS NULL OR v_pix_key IS NULL OR coalesce((p_data->>'confirmed')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'cadastro incompleto'; END IF;
    IF (v_person_type = 'pf' AND char_length(v_tax_id) <> 11) OR (v_person_type = 'pj' AND char_length(v_tax_id) <> 14) THEN RAISE EXCEPTION 'documento inválido'; END IF;
    IF v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' OR char_length(v_phone) NOT BETWEEN 10 AND 13 OR char_length(v_postal) <> 8 OR v_state !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'contato ou endereço inválido'; END IF;
  END IF;
  INSERT INTO public.owner_onboarding_profiles (implementation_id, person_type, legal_name, trade_name, tax_id, email, phone, postal_code, street, number, complement, district, city, state, current_step, submitted_at)
  VALUES (v_invitation.implementation_id, v_person_type, v_legal_name, v_trade_name, nullif(v_tax_id,''), v_email, nullif(v_phone,''), nullif(v_postal,''), nullif(trim(p_data->>'street'),''), nullif(trim(p_data->>'number'),''), nullif(trim(p_data->>'complement'),''), nullif(trim(p_data->>'district'),''), nullif(trim(p_data->>'city'),''), v_state, v_step, CASE WHEN p_submit THEN now() ELSE NULL END)
  ON CONFLICT (implementation_id) DO UPDATE SET person_type=excluded.person_type, legal_name=excluded.legal_name, trade_name=excluded.trade_name, tax_id=excluded.tax_id, email=excluded.email, phone=excluded.phone, postal_code=excluded.postal_code, street=excluded.street, number=excluded.number, complement=excluded.complement, district=excluded.district, city=excluded.city, state=excluded.state, current_step=excluded.current_step, submitted_at=CASE WHEN p_submit THEN coalesce(owner_onboarding_profiles.submitted_at, now()) ELSE owner_onboarding_profiles.submitted_at END;
  INSERT INTO public.owner_payout_accounts (implementation_id, bank_name, account_holder, holder_tax_id, pix_type, pix_key, is_primary)
  VALUES (v_invitation.implementation_id, v_bank, v_holder, nullif(v_holder_tax,''), v_pix_type, v_pix_key, true)
  ON CONFLICT (implementation_id) DO UPDATE SET bank_name=excluded.bank_name, account_holder=excluded.account_holder, holder_tax_id=excluded.holder_tax_id, pix_type=excluded.pix_type, pix_key=excluded.pix_key, is_primary=true;
  UPDATE public.owner_portal_invitations SET last_access_at = now() WHERE id = v_invitation.id;
  RETURN public.owner_onboarding_draft_resolve(p_token);
END;
$$;
REVOKE ALL ON FUNCTION public.owner_onboarding_draft_save(text, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_save(text, jsonb, boolean) TO anon, authenticated;