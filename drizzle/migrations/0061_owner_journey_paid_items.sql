CREATE OR REPLACE FUNCTION public.owner_journey_resolve_proposal(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_inv public.owner_portal_invitations%rowtype;
  v_cur public.proposals%rowtype;
  v_conf public.owner_proposal_confirmations%rowtype;
  v_paid jsonb;
BEGIN
  SELECT * INTO v_inv FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex');
  IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'acesso inválido' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_cur FROM public.proposals
  WHERE implementation_id = v_inv.implementation_id
    AND status IN ('published','accepted') AND snapshot IS NOT NULL
  ORDER BY version DESC LIMIT 1;

  SELECT * INTO v_conf FROM public.owner_proposal_confirmations
  WHERE implementation_id = v_inv.implementation_id AND result = 'confirmed'
  ORDER BY version DESC, confirmed_at DESC LIMIT 1;

  SELECT coalesce(paid_items, '{}'::jsonb) INTO v_paid FROM public.implementation_contract_conditions
  WHERE implementation_id = v_inv.implementation_id;

  RETURN jsonb_build_object(
    'current', CASE WHEN v_cur.id IS NULL THEN NULL ELSE jsonb_build_object(
      'proposalId', v_cur.id, 'version', v_cur.version, 'status', v_cur.status,
      'publishedAt', v_cur.published_at, 'snapshot', v_cur.snapshot) END,
    'confirmation', CASE WHEN v_conf.id IS NULL THEN NULL ELSE jsonb_build_object(
      'proposalId', v_conf.proposal_id, 'version', v_conf.version,
      'confirmedAt', v_conf.confirmed_at, 'confirmedName', v_conf.confirmed_name,
      'snapshot', v_conf.snapshot) END,
    'needsConfirmation', v_cur.id IS NOT NULL AND (v_conf.id IS NULL OR v_conf.proposal_id <> v_cur.id),
    'paidItems', coalesce(v_paid, '{}'::jsonb)
  );
END $function$;