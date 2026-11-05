CREATE OR REPLACE FUNCTION public.owner_journey_accept_proposal(p_token text, p_accepted_name text, p_proposal_id uuid, p_command_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_inv public.owner_portal_invitations%rowtype;
  v_cur public.proposals%rowtype;
  v_existing public.owner_proposal_confirmations%rowtype;
BEGIN
  IF p_accepted_name IS NULL OR length(trim(p_accepted_name)) < 3 THEN
    RAISE EXCEPTION 'nome inválido';
  END IF;
  SELECT * INTO v_inv FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') FOR UPDATE;
  IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'acesso inválido';
  END IF;

  SELECT * INTO v_existing FROM public.owner_proposal_confirmations WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_existing.invitation_id <> v_inv.id THEN RAISE EXCEPTION 'comando inválido'; END IF;
    RETURN public.owner_journey_resolve_proposal(p_token);
  END IF;

  SELECT * INTO v_cur FROM public.proposals
  WHERE implementation_id = v_inv.implementation_id
    AND status IN ('published','accepted') AND snapshot IS NOT NULL
  ORDER BY version DESC LIMIT 1;
  IF v_cur.id IS NULL THEN RAISE EXCEPTION 'proposta indisponível'; END IF;
  IF v_cur.id <> p_proposal_id THEN
    RAISE EXCEPTION 'condições atualizadas';
  END IF;

  INSERT INTO public.owner_proposal_confirmations
    (implementation_id, proposal_id, invitation_id, version, snapshot, snapshot_hash,
     confirmed_name, statement, command_id)
  VALUES (v_inv.implementation_id, v_cur.id, v_inv.id, v_cur.version, v_cur.snapshot,
     encode(digest(v_cur.snapshot::text, 'sha256'), 'hex'), trim(p_accepted_name),
     'Li e confirmo as condições comerciais da proposta', p_command_id)
  ON CONFLICT (proposal_id, invitation_id) DO NOTHING;

  UPDATE public.proposals SET status = 'accepted', accepted_at = now(), accepted_name = trim(p_accepted_name)
  WHERE id = v_cur.id AND status = 'published' AND accepted_at IS NULL;

  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (NULL, 'owner_proposal_confirmed', 'proposal', v_cur.id,
    jsonb_build_object('implementationId', v_inv.implementation_id, 'version', v_cur.version,
      'invitationId', v_inv.id, 'commandId', p_command_id));

  UPDATE public.owner_portal_invitations SET last_access_at = now() WHERE id = v_inv.id;
  RETURN public.owner_journey_resolve_proposal(p_token);
END $function$;