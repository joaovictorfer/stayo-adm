CREATE OR REPLACE FUNCTION public.proposal_public_link_status(p_token text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_link public.proposal_share_links%rowtype;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN
    RETURN 'invalid';
  END IF;
  SELECT * INTO v_link FROM public.proposal_share_links
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') AND link_type = 'presentation';
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN 'revoked'; END IF;
  IF v_link.expires_at < now() THEN RETURN 'expired'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = v_link.proposal_id AND p.status IN ('published','accepted','superseded') AND p.snapshot IS NOT NULL
  ) THEN RETURN 'invalid'; END IF;
  RETURN 'active';
END;
$$;
REVOKE ALL ON FUNCTION public.proposal_public_link_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proposal_public_link_status(text) TO anon, authenticated;
COMMENT ON FUNCTION public.proposal_public_link_status(text) IS 'Retorna apenas o estado (active/expired/revoked/invalid) de um token de apresentação; nenhum dado da proposta.';