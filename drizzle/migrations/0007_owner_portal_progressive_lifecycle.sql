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
  v_project public.implementation_projects%rowtype;
  v_snapshot jsonb;
BEGIN
  SELECT * INTO v_invitation
  FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
  LIMIT 1;

  IF NOT FOUND OR v_invitation.revoked_at IS NOT NULL OR v_invitation.expires_at < now() THEN
    RETURN;
  END IF;

  SELECT * INTO v_project
  FROM public.implementation_projects
  WHERE id = v_invitation.implementation_id;

  v_snapshot := coalesce(v_invitation.public_snapshot, '{}'::jsonb);
  IF FOUND THEN
    v_snapshot := jsonb_set(v_snapshot, '{status}', to_jsonb(v_project.status::text), true);
    v_snapshot := jsonb_set(v_snapshot, '{corePropertyId}', coalesce(to_jsonb(v_project.core_property_id), 'null'::jsonb), true);
    v_snapshot := jsonb_set(v_snapshot, '{coreOwnerId}', coalesce(to_jsonb(v_project.core_owner_id), 'null'::jsonb), true);
    v_snapshot := jsonb_set(v_snapshot, '{activationDate}', CASE WHEN v_project.status = 'ativo' AND v_project.core_property_id IS NOT NULL THEN to_jsonb(v_project.updated_at::text) ELSE coalesce(v_snapshot->'activationDate', 'null'::jsonb) END, true);
    v_snapshot := jsonb_set(v_snapshot, '{refreshedAt}', to_jsonb(now()::text), true);
  END IF;

  UPDATE public.owner_portal_invitations
  SET last_access_at = now()
  WHERE id = v_invitation.id;

  RETURN QUERY SELECT v_invitation.expires_at, v_invitation.revoked_at, v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_portal_resolve(text) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_portal_resolve(text) TO anon, authenticated;