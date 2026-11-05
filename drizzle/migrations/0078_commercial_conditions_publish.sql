ALTER TABLE public.implementation_contract_conditions ADD COLUMN IF NOT EXISTS standard_copy jsonb;
COMMENT ON COLUMN public.implementation_contract_conditions.standard_copy IS 'Cópia do padrão comercial STAYO aplicada a esta ficha; diferenças viram exceções do imóvel.';

CREATE OR REPLACE FUNCTION public.commercial_value_fingerprint(p_snapshot jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'total', (p_snapshot->>'total')::numeric,
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('d', e->>'description', 't', (e->>'total')::numeric)) FROM jsonb_array_elements(coalesce(p_snapshot->'items','[]'::jsonb)) e), '[]'::jsonb),
    'cc', coalesce((SELECT jsonb_object_agg(k, p_snapshot->'contractConditions'->k) FROM unnest(ARRAY[
      'administrationFee','durationMonths','turnoverCleaningFee','turnoverCleaningPayer','initialCleaningOption',
      'initialCleaningFee','initialCleaningCostBearer','maintenanceLimit','noticePeriodDays','exclusivity',
      'ownerUseLimitMode','ownerUseLimitDays','ownerUseNoticeDays','assignmentMode','assignmentNoticeDays',
      'linenMode','advisoryMode']) k), '{}'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_conditions(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_impl uuid; v_cmd uuid;
  v_cc public.implementation_contract_conditions%rowtype;
  v_draft public.proposals%rowtype;
  v_base public.proposals%rowtype;
  v_accepted public.proposals%rowtype;
  v_new jsonb; v_new_row public.proposals%rowtype;
  v_items jsonb; v_kind text := 'values';
BEGIN
  IF public.has_admin_role('super_admin','admin','commercial') IS NOT TRUE THEN
    RAISE EXCEPTION 'sem permissão para salvar condições';
  END IF;
  BEGIN
    v_impl := (p_data->>'implementationId')::uuid;
    v_cmd := (p_data->>'commandId')::uuid;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'comando inválido'; END;
  PERFORM pg_advisory_xact_lock(hashtext('conditions_publish:' || v_impl::text));

  SELECT * INTO v_new_row FROM public.proposals WHERE publish_command_id = v_cmd;
  IF found THEN
    RETURN jsonb_build_object('proposalId', v_new_row.id, 'version', v_new_row.version, 'status', v_new_row.status, 'replayed', true);
  END IF;

  SELECT * INTO v_cc FROM public.implementation_contract_conditions WHERE implementation_id = v_impl;
  IF NOT found OR v_cc.administration_fee IS NULL OR v_cc.duration_months IS NULL
     OR v_cc.turnover_cleaning_fee IS NULL OR v_cc.turnover_cleaning_payer IS NULL
     OR v_cc.initial_cleaning_option IS NULL OR v_cc.initial_cleaning_option = 'tbd' THEN
    RAISE EXCEPTION 'condições incompletas';
  END IF;

  SELECT * INTO v_draft FROM public.proposals WHERE implementation_id = v_impl AND status = 'draft' ORDER BY version DESC LIMIT 1 FOR UPDATE;
  SELECT * INTO v_base FROM public.proposals WHERE implementation_id = v_impl AND status IN ('published','accepted','superseded') ORDER BY version DESC LIMIT 1;

  IF v_draft.id IS NULL THEN
    v_items := coalesce(v_base.items, '[]'::jsonb);
    IF jsonb_array_length(v_items) = 0 THEN
      v_items := jsonb_build_array(jsonb_build_object('description','Implantação STAYO','quantity',1,'unitValue',500,'discount',0,'total',500,'details',null,'scope','[]'::jsonb,'paid',false,'paidAt',null));
    END IF;
    INSERT INTO public.proposals (implementation_id, version, items, total, status, draft_item_options, draft_partnership_object,
      draft_responsibilities, required_signatories, draft_revision, updated_by)
    VALUES (v_impl, coalesce((SELECT max(version) FROM public.proposals WHERE implementation_id = v_impl),0)+1,
      v_items, (SELECT coalesce(sum((e->>'total')::numeric),0) FROM jsonb_array_elements(v_items) e), 'draft',
      coalesce(v_base.draft_item_options,'[]'::jsonb), coalesce(v_base.draft_partnership_object, v_base.snapshot->>'partnershipObject'),
      coalesce(v_base.draft_responsibilities,'[]'::jsonb), coalesce(v_base.required_signatories,'[]'::jsonb), 1, auth.uid())
    RETURNING * INTO v_draft;
  END IF;

  v_new := public.admin_publish_proposal(jsonb_build_object('proposalId', v_draft.id, 'expectedRevision', v_draft.draft_revision, 'commandId', v_cmd));
  SELECT * INTO v_new_row FROM public.proposals WHERE id = v_draft.id;

  -- Sem nenhuma mudança em relação à última versão: não cria versão.
  IF v_base.id IS NOT NULL AND (v_base.snapshot - 'publishedAt' - 'version' - 'proposalId') = (v_new_row.snapshot - 'publishedAt' - 'version' - 'proposalId') THEN
    RAISE EXCEPTION 'nenhuma alteração para publicar';
  END IF;

  SELECT * INTO v_accepted FROM public.proposals WHERE implementation_id = v_impl AND status = 'accepted' AND id <> v_new_row.id ORDER BY version DESC LIMIT 1;
  IF v_accepted.id IS NOT NULL AND public.commercial_value_fingerprint(v_accepted.snapshot) = public.commercial_value_fingerprint(v_new_row.snapshot) THEN
    -- Só texto mudou: a nova versão herda o aceite; a versão aceita original fica preservada.
    UPDATE public.proposals SET status = 'accepted', accepted_at = v_accepted.accepted_at, accepted_name = v_accepted.accepted_name, updated_at = now()
    WHERE id = v_new_row.id;
    v_kind := 'text';
  ELSIF v_accepted.id IS NULL THEN
    v_kind := 'pre_acceptance';
  END IF;

  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'conditions_published', 'proposal', v_new_row.id, jsonb_build_object('implementationId', v_impl, 'version', v_new_row.version, 'change', v_kind));

  RETURN jsonb_build_object('proposalId', v_new_row.id, 'version', v_new_row.version, 'change', v_kind,
    'requiresConfirmation', v_kind = 'values');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_publish_conditions(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_conditions(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.proposal_accept_by_token(p_token text, p_accepted_name text)
 RETURNS TABLE(proposal_id uuid, implementation_id uuid, version integer, items jsonb, total numeric, accepted_at timestamp with time zone, accepted_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_link public.proposal_share_links%rowtype;
  v_proposal public.proposals%rowtype;
BEGIN
  SELECT * INTO v_link FROM public.proposal_share_links
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') AND link_type = 'legacy'
    AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at >= now());
  IF NOT FOUND THEN RAISE EXCEPTION 'proposta não encontrada'; END IF;

  SELECT * INTO v_proposal FROM public.proposals pr WHERE pr.id = v_link.proposal_id;
  IF v_proposal.status = 'superseded' OR EXISTS (
    SELECT 1 FROM public.proposals p2 WHERE p2.implementation_id = v_proposal.implementation_id
      AND p2.version > v_proposal.version AND p2.status IN ('published','accepted')) THEN
    RAISE EXCEPTION 'condições atualizadas';
  END IF;

  UPDATE public.proposals AS pr SET accepted_at = now(), accepted_name = p_accepted_name, status = 'accepted'
  WHERE pr.id = v_link.proposal_id AND pr.status = 'published' AND pr.accepted_at IS NULL
  RETURNING pr.* INTO v_proposal;
  IF NOT FOUND THEN
    SELECT * INTO v_proposal FROM public.proposals AS pr WHERE pr.id = v_link.proposal_id AND pr.status = 'accepted';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposta não disponível para aceite'; END IF;

  RETURN QUERY SELECT v_proposal.id, v_proposal.implementation_id, v_proposal.version, v_proposal.items,
    v_proposal.total, v_proposal.accepted_at, v_proposal.accepted_name, v_proposal.created_at;
END;
$function$;