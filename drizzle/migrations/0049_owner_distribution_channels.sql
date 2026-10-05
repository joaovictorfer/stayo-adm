ALTER TABLE public.implementation_projects
  ADD COLUMN IF NOT EXISTS distribution_channels text[],
  ADD COLUMN IF NOT EXISTS airbnb_account_email text,
  ADD COLUMN IF NOT EXISTS distribution_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS distribution_updated_by text;

COMMENT ON COLUMN public.implementation_projects.distribution_channels IS 'Canais escolhidos pelo proprietário (airbnb sempre incluso): airbnb, booking, decolar, direct';

CREATE OR REPLACE FUNCTION public.owner_platforms_resolve(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE v_inv public.owner_portal_invitations%rowtype; v_row public.implementation_projects%rowtype;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  SELECT * INTO v_inv FROM public.owner_portal_invitations WHERE token_hash = encode(digest(p_token,'sha256'),'hex');
  IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at < now() THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  IF NOT public.owner_journey_current_confirmed(v_inv.implementation_id) THEN RAISE EXCEPTION 'proposta não confirmada'; END IF;
  SELECT * INTO v_row FROM public.implementation_projects WHERE id = v_inv.implementation_id;
  RETURN jsonb_build_object('channels', to_jsonb(v_row.distribution_channels), 'airbnbEmail', v_row.airbnb_account_email);
END $$;

CREATE OR REPLACE FUNCTION public.owner_platforms_save(p_token text, p_channels text[], p_airbnb_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE v_inv public.owner_portal_invitations%rowtype; v_channels text[]; v_email text := lower(nullif(trim(p_airbnb_email),''));
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  SELECT * INTO v_inv FROM public.owner_portal_invitations WHERE token_hash = encode(digest(p_token,'sha256'),'hex');
  IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at < now() THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  IF NOT public.owner_journey_current_confirmed(v_inv.implementation_id) THEN RAISE EXCEPTION 'proposta não confirmada'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_channels,'{}')) c WHERE c NOT IN ('airbnb','booking','decolar','direct')) THEN RAISE EXCEPTION 'canal inválido'; END IF;
  IF v_email IS NOT NULL AND (char_length(v_email) > 255 OR v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$') THEN RAISE EXCEPTION 'e-mail inválido'; END IF;
  SELECT array_agg(c ORDER BY array_position(ARRAY['airbnb','booking','decolar','direct'], c)) INTO v_channels
  FROM (SELECT DISTINCT c FROM unnest(array_append(coalesce(p_channels,'{}'),'airbnb')) c) s;
  UPDATE public.implementation_projects
     SET distribution_channels = v_channels, airbnb_account_email = v_email,
         distribution_updated_at = now(), distribution_updated_by = 'owner'
   WHERE id = v_inv.implementation_id;
  RETURN jsonb_build_object('channels', to_jsonb(v_channels), 'airbnbEmail', v_email);
END $$;

REVOKE ALL ON FUNCTION public.owner_platforms_resolve(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_platforms_save(text, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_platforms_resolve(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_platforms_save(text, text[], text) TO anon, authenticated;