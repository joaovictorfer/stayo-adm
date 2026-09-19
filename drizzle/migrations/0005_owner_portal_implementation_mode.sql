ALTER TABLE public.owner_portal_invitations
  ADD COLUMN IF NOT EXISTS public_snapshot jsonb;

GRANT SELECT, INSERT, UPDATE ON public.owner_portal_invitations TO authenticated;
GRANT ALL ON public.owner_portal_invitations TO service_role;

CREATE OR REPLACE FUNCTION public.owner_portal_resolve(p_token text)
RETURNS TABLE (
  expires_at timestamptz,
  revoked_at timestamptz,
  public_snapshot jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invitation public.owner_portal_invitations%rowtype;
BEGIN
  SELECT * INTO v_invitation
  FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
  LIMIT 1;

  IF NOT FOUND OR v_invitation.revoked_at IS NOT NULL OR v_invitation.expires_at < now() THEN
    RETURN;
  END IF;

  UPDATE public.owner_portal_invitations
  SET last_access_at = now()
  WHERE id = v_invitation.id;

  RETURN QUERY SELECT v_invitation.expires_at, v_invitation.revoked_at, v_invitation.public_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_portal_resolve(text) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_portal_resolve(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_portal_accept_proposal(p_token text, p_accepted_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invitation public.owner_portal_invitations%rowtype;
  v_snapshot jsonb;
BEGIN
  IF length(trim(p_accepted_name)) < 2 THEN
    RAISE EXCEPTION 'nome inválido';
  END IF;

  SELECT * INTO v_invitation
  FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
  FOR UPDATE;

  IF NOT FOUND OR v_invitation.revoked_at IS NOT NULL OR v_invitation.expires_at < now() THEN
    RAISE EXCEPTION 'acesso inválido';
  END IF;
  IF v_invitation.public_snapshot->'proposal' IS NULL OR v_invitation.public_snapshot->'proposal' = 'null'::jsonb THEN
    RAISE EXCEPTION 'proposta indisponível';
  END IF;

  v_snapshot := jsonb_set(
    jsonb_set(v_invitation.public_snapshot, '{proposal,acceptedAt}', to_jsonb(now()::text), true),
    '{proposal,acceptedName}', to_jsonb(trim(p_accepted_name)), true
  );

  UPDATE public.owner_portal_invitations
  SET public_snapshot = v_snapshot, last_access_at = now()
  WHERE id = v_invitation.id;

  RETURN v_snapshot->'proposal';
END;
$$;

REVOKE ALL ON FUNCTION public.owner_portal_accept_proposal(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_portal_accept_proposal(text, text) TO anon, authenticated;