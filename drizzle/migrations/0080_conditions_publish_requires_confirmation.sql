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

  IF v_base.id IS NOT NULL AND (v_base.snapshot - 'publishedAt' - 'version' - 'proposalId') = (v_new_row.snapshot - 'publishedAt' - 'version' - 'proposalId') THEN
    RAISE EXCEPTION 'nenhuma alteração para publicar';
  END IF;

  SELECT * INTO v_accepted FROM public.proposals WHERE implementation_id = v_impl AND status = 'accepted' AND id <> v_new_row.id ORDER BY version DESC LIMIT 1;
  IF v_accepted.id IS NOT NULL AND public.commercial_value_fingerprint(v_accepted.snapshot) = public.commercial_value_fingerprint(v_new_row.snapshot) THEN
    UPDATE public.proposals SET status = 'accepted', accepted_at = v_accepted.accepted_at, accepted_name = v_accepted.accepted_name, updated_at = now()
    WHERE id = v_new_row.id;
    v_kind := 'text';
  ELSIF v_accepted.id IS NULL THEN
    v_kind := 'pre_acceptance';
  END IF;

  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'conditions_published', 'proposal', v_new_row.id, jsonb_build_object('implementationId', v_impl, 'version', v_new_row.version, 'change', v_kind));

  RETURN jsonb_build_object('proposalId', v_new_row.id, 'version', v_new_row.version, 'change', v_kind,
    'requiresConfirmation', v_kind <> 'text');
END;
$$;