ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS draft_item_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS draft_partnership_object text;

CREATE OR REPLACE FUNCTION public.admin_list_proposal_versions(p_implementation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF public.has_admin_role('super_admin', 'admin', 'commercial') IS NOT TRUE THEN
    RAISE EXCEPTION 'sem permissão para consultar propostas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.implementation_projects WHERE id = p_implementation_id) THEN
    RAISE EXCEPTION 'oportunidade não encontrada';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'implementationId', p.implementation_id,
    'version', p.version,
    'status', p.status,
    'items', p.items,
    'total', p.total,
    'draftItemOptions', p.draft_item_options,
    'draftPartnershipObject', p.draft_partnership_object,
    'draftResponsibilities', p.draft_responsibilities,
    'requiredSignatories', p.required_signatories,
    'snapshot', p.snapshot,
    'draftRevision', p.draft_revision,
    'publishedAt', p.published_at,
    'publishedBy', p.published_by,
    'acceptedAt', p.accepted_at,
    'acceptedName', p.accepted_name,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  ) ORDER BY p.version DESC), '[]'::jsonb)
  INTO v_result
  FROM public.proposals p
  WHERE p.implementation_id = p_implementation_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_proposal_draft(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_implementation_id uuid;
  v_proposal_id uuid;
  v_command_id uuid;
  v_expected_revision integer;
  v_items_input jsonb := coalesce(p_data->'items', '[]'::jsonb);
  v_responsibilities jsonb := coalesce(p_data->'responsibilities', '[]'::jsonb);
  v_signatories jsonb := coalesce(p_data->'requiredSignatories', '[]'::jsonb);
  v_options_input jsonb := coalesce(p_data->'itemOptions', '[]'::jsonb);
  v_object text := nullif(trim(coalesce(p_data->>'partnershipObject', '')), '');
  v_options jsonb;
  v_items jsonb;
  v_total numeric;
  v_version integer;
  v_proposal public.proposals%rowtype;
BEGIN
  IF public.has_admin_role('super_admin', 'admin', 'commercial') IS NOT TRUE THEN
    RAISE EXCEPTION 'sem permissão para editar proposta';
  END IF;

  BEGIN
    v_implementation_id := (p_data->>'implementationId')::uuid;
    v_command_id := (p_data->>'commandId')::uuid;
    v_proposal_id := nullif(p_data->>'proposalId', '')::uuid;
    v_expected_revision := nullif(p_data->>'expectedRevision', '')::integer;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'dados da proposta inválidos';
  END;

  IF NOT EXISTS (SELECT 1 FROM public.implementation_projects WHERE id = v_implementation_id) THEN
    RAISE EXCEPTION 'oportunidade não encontrada';
  END IF;
  IF jsonb_typeof(v_items_input) <> 'array' OR jsonb_array_length(v_items_input) = 0 THEN
    RAISE EXCEPTION 'adicione ao menos um item à proposta';
  END IF;
  IF jsonb_typeof(v_responsibilities) <> 'array' THEN RAISE EXCEPTION 'responsabilidades inválidas'; END IF;
  IF jsonb_typeof(v_signatories) <> 'array' THEN RAISE EXCEPTION 'signatários inválidos'; END IF;
  IF jsonb_typeof(v_options_input) <> 'array' OR jsonb_array_length(v_options_input) > 100 THEN
    RAISE EXCEPTION 'lista de serviços inválida';
  END IF;
  IF v_object IS NOT NULL AND char_length(v_object) > 2000 THEN
    RAISE EXCEPTION 'objeto da parceria muito longo';
  END IF;

  BEGIN
    SELECT jsonb_agg(jsonb_build_object(
      'description', q.description,
      'quantity', q.quantity,
      'unitValue', q.unit_value,
      'discount', q.discount,
      'total', greatest(0, q.quantity * q.unit_value - q.discount),
      'details', q.details,
      'scope', q.scope
    ) ORDER BY q.ord),
    coalesce(sum(greatest(0, q.quantity * q.unit_value - q.discount)), 0)
    INTO v_items, v_total
    FROM (
      SELECT ord,
        regexp_replace(trim(value->>'description'), '\s+', ' ', 'g') AS description,
        (value->>'quantity')::numeric AS quantity,
        (value->>'unitValue')::numeric AS unit_value,
        coalesce((value->>'discount')::numeric, 0) AS discount,
        nullif(left(trim(coalesce(value->>'details', '')), 1000), '') AS details,
        coalesce((
          SELECT jsonb_agg(left(trim(s), 200) ORDER BY so)
          FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(value->'scope') = 'array' THEN value->'scope' ELSE '[]'::jsonb END
          ) WITH ORDINALITY AS sc(s, so)
          WHERE trim(s) <> '' AND so <= 30
        ), '[]'::jsonb) AS scope
      FROM jsonb_array_elements(v_items_input) WITH ORDINALITY AS e(value, ord)
    ) q
    WHERE char_length(q.description) BETWEEN 1 AND 240
      AND q.quantity > 0 AND q.unit_value >= 0 AND q.discount >= 0;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'itens da proposta inválidos';
  END;
  IF v_items IS NULL OR jsonb_array_length(v_items) <> jsonb_array_length(v_items_input) THEN
    RAISE EXCEPTION 'itens da proposta inválidos';
  END IF;

  BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'description', regexp_replace(trim(value->>'description'), '\s+', ' ', 'g'),
      'quantity', (value->>'quantity')::numeric,
      'unitValue', (value->>'unitValue')::numeric,
      'discount', coalesce((value->>'discount')::numeric, 0),
      'included', coalesce((value->>'included')::boolean, true),
      'optional', coalesce((value->>'optional')::boolean, false),
      'templateKey', nullif(left(coalesce(value->>'templateKey', ''), 60), ''),
      'details', nullif(left(trim(coalesce(value->>'details', '')), 1000), ''),
      'scope', coalesce((
        SELECT jsonb_agg(left(trim(s), 200) ORDER BY so)
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(value->'scope') = 'array' THEN value->'scope' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS sc(s, so)
        WHERE trim(s) <> '' AND so <= 30
      ), '[]'::jsonb)
    ) ORDER BY ord), '[]'::jsonb)
    INTO v_options
    FROM jsonb_array_elements(v_options_input) WITH ORDINALITY AS e(value, ord)
    WHERE char_length(trim(coalesce(value->>'description', ''))) BETWEEN 1 AND 240
      AND (value->>'quantity')::numeric > 0
      AND (value->>'unitValue')::numeric >= 0
      AND coalesce((value->>'discount')::numeric, 0) >= 0;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'lista de serviços inválida';
  END;

  PERFORM pg_advisory_xact_lock(hashtext('proposal_draft:' || v_implementation_id::text));

  SELECT * INTO v_proposal FROM public.proposals WHERE last_draft_command_id = v_command_id;
  IF found THEN
    RETURN (public.admin_list_proposal_versions(v_implementation_id)->0);
  END IF;

  IF v_proposal_id IS NOT NULL THEN
    SELECT * INTO v_proposal FROM public.proposals WHERE id = v_proposal_id FOR UPDATE;
    IF NOT found OR v_proposal.implementation_id <> v_implementation_id THEN
      RAISE EXCEPTION 'draft não encontrado';
    END IF;
    IF v_proposal.status <> 'draft' THEN
      RAISE EXCEPTION 'versão publicada é imutável; crie uma nova versão';
    END IF;
    IF v_expected_revision IS NULL OR v_proposal.draft_revision <> v_expected_revision THEN
      RAISE EXCEPTION 'conflito de edição; recarregue a proposta';
    END IF;
  ELSE
    SELECT * INTO v_proposal FROM public.proposals
    WHERE implementation_id = v_implementation_id AND status = 'draft'
    ORDER BY version DESC LIMIT 1 FOR UPDATE;
  END IF;

  IF v_proposal.id IS NOT NULL THEN
    UPDATE public.proposals
    SET items = v_items,
        total = v_total,
        draft_item_options = v_options,
        draft_partnership_object = v_object,
        draft_responsibilities = v_responsibilities,
        required_signatories = v_signatories,
        draft_revision = draft_revision + 1,
        last_draft_command_id = v_command_id,
        updated_at = now(),
        updated_by = v_actor
    WHERE id = v_proposal.id
    RETURNING * INTO v_proposal;
  ELSE
    SELECT coalesce(max(version), 0) + 1 INTO v_version
    FROM public.proposals WHERE implementation_id = v_implementation_id;

    INSERT INTO public.proposals (
      implementation_id, version, items, total, status,
      draft_item_options, draft_partnership_object,
      draft_responsibilities, required_signatories,
      draft_revision, last_draft_command_id, updated_by
    ) VALUES (
      v_implementation_id, v_version, v_items, v_total, 'draft',
      v_options, v_object,
      v_responsibilities, v_signatories,
      1, v_command_id, v_actor
    ) RETURNING * INTO v_proposal;
  END IF;

  RETURN (SELECT elem FROM jsonb_array_elements(public.admin_list_proposal_versions(v_implementation_id)) elem
          WHERE (elem->>'id')::uuid = v_proposal.id LIMIT 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_proposal(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_proposal_id uuid;
  v_command_id uuid;
  v_expected_revision integer;
  v_proposal public.proposals%rowtype;
  v_snapshot jsonb;
  v_now timestamptz := now();
BEGIN
  IF public.has_admin_role('super_admin', 'admin', 'commercial') IS NOT TRUE THEN
    RAISE EXCEPTION 'sem permissão para publicar proposta';
  END IF;
  BEGIN
    v_proposal_id := (p_data->>'proposalId')::uuid;
    v_command_id := (p_data->>'commandId')::uuid;
    v_expected_revision := (p_data->>'expectedRevision')::integer;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'comando de publicação inválido';
  END;

  PERFORM pg_advisory_xact_lock(hashtext('proposal_publish:' || v_proposal_id::text));

  SELECT * INTO v_proposal FROM public.proposals WHERE publish_command_id = v_command_id;
  IF found THEN
    RETURN (SELECT elem FROM jsonb_array_elements(public.admin_list_proposal_versions(v_proposal.implementation_id)) elem
            WHERE (elem->>'id')::uuid = v_proposal.id LIMIT 1);
  END IF;

  SELECT * INTO v_proposal FROM public.proposals WHERE id = v_proposal_id FOR UPDATE;
  IF NOT found THEN RAISE EXCEPTION 'proposta não encontrada'; END IF;
  IF v_proposal.status <> 'draft' THEN RAISE EXCEPTION 'somente draft pode ser publicado'; END IF;
  IF v_proposal.draft_revision <> v_expected_revision THEN RAISE EXCEPTION 'conflito de edição; recarregue a proposta'; END IF;
  IF jsonb_array_length(v_proposal.items) = 0 THEN RAISE EXCEPTION 'proposta sem itens'; END IF;

  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'proposalId', v_proposal.id,
    'implementationId', v_proposal.implementation_id,
    'version', v_proposal.version,
    'opportunity', jsonb_build_object('code', ip.code, 'title', ip.nickname),
    'partnershipObject', v_proposal.draft_partnership_object,
    'items', v_proposal.items,
    'total', v_proposal.total,
    'commercialTerms', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'label', ct.label, 'chargeType', ct.charge_type, 'value', ct.value,
        'optional', ct.optional, 'displayOrder', ct.display_order, 'notes', ct.notes
      ) ORDER BY ct.display_order, ct.label)
      FROM public.commercial_terms ct WHERE ct.implementation_id = v_proposal.implementation_id
    ), '[]'::jsonb),
    'contractConditions', coalesce((
      SELECT jsonb_build_object(
        'administrationFee', cc.administration_fee,
        'cleaningResponsibility', cc.cleaning_responsibility,
        'payoutRule', cc.payout_rule,
        'maintenanceLimit', cc.maintenance_limit,
        'exclusivity', cc.exclusivity,
        'durationMonths', cc.duration_months,
        'noticePeriodDays', cc.notice_period_days
      )
      FROM public.implementation_contract_conditions cc
      WHERE cc.implementation_id = v_proposal.implementation_id
    ), '{}'::jsonb),
    'responsibilities', v_proposal.draft_responsibilities,
    'content', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'title', pcb.title, 'body', pcb.body, 'displayOrder', pcb.display_order
      ) ORDER BY pcb.display_order, pcb.created_at)
      FROM public.proposal_content_blocks pcb
      WHERE pcb.implementation_id = v_proposal.implementation_id AND pcb.visibility = 'proposta'
    ), '[]'::jsonb),
    'requiredSignatories', v_proposal.required_signatories,
    'publishedAt', v_now
  ) INTO v_snapshot
  FROM public.implementation_projects ip
  WHERE ip.id = v_proposal.implementation_id;

  UPDATE public.proposals
  SET status = 'superseded', updated_at = v_now, updated_by = v_actor
  WHERE implementation_id = v_proposal.implementation_id AND id <> v_proposal.id AND status = 'published';

  UPDATE public.proposals
  SET status = 'published', snapshot = v_snapshot, published_at = v_now, published_by = v_actor,
      publish_command_id = v_command_id, updated_at = v_now, updated_by = v_actor
  WHERE id = v_proposal.id
  RETURNING * INTO v_proposal;

  RETURN (SELECT elem FROM jsonb_array_elements(public.admin_list_proposal_versions(v_proposal.implementation_id)) elem
          WHERE (elem->>'id')::uuid = v_proposal.id LIMIT 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_published_proposal_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF old.status IN ('published', 'superseded', 'accepted') THEN
    IF new.implementation_id IS DISTINCT FROM old.implementation_id
       OR new.version IS DISTINCT FROM old.version
       OR new.items IS DISTINCT FROM old.items
       OR new.total IS DISTINCT FROM old.total
       OR new.draft_item_options IS DISTINCT FROM old.draft_item_options
       OR new.draft_partnership_object IS DISTINCT FROM old.draft_partnership_object
       OR new.draft_responsibilities IS DISTINCT FROM old.draft_responsibilities
       OR new.required_signatories IS DISTINCT FROM old.required_signatories
       OR new.snapshot IS DISTINCT FROM old.snapshot
       OR new.published_at IS DISTINCT FROM old.published_at
       OR new.published_by IS DISTINCT FROM old.published_by
       OR new.publish_command_id IS DISTINCT FROM old.publish_command_id THEN
      RAISE EXCEPTION 'versão publicada é imutável';
    END IF;
    IF old.status = 'accepted' AND (
      new.status IS DISTINCT FROM old.status
      OR new.accepted_at IS DISTINCT FROM old.accepted_at
      OR new.accepted_name IS DISTINCT FROM old.accepted_name
    ) THEN
      RAISE EXCEPTION 'versão aceita é imutável';
    END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.proposal_public_resolve_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN
    RETURN NULL;
  END IF;

  SELECT p.snapshot INTO v_snapshot
  FROM public.proposal_share_links AS link
  JOIN public.proposals AS p ON p.id = link.proposal_id AND p.implementation_id = link.implementation_id
  WHERE link.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND link.revoked_at IS NULL
    AND (link.expires_at IS NULL OR link.expires_at >= now())
    AND p.status IN ('published', 'accepted', 'superseded')
    AND p.snapshot IS NOT NULL
    AND jsonb_typeof(p.snapshot) = 'object'
    AND p.snapshot->>'proposalId' = p.id::text
    AND p.snapshot->>'implementationId' = p.implementation_id::text
    AND p.snapshot->>'version' = p.version::text
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'schemaVersion', v_snapshot->'schemaVersion',
    'proposalId', v_snapshot->'proposalId',
    'implementationId', v_snapshot->'implementationId',
    'version', v_snapshot->'version',
    'opportunity', v_snapshot->'opportunity',
    'partnershipObject', v_snapshot->'partnershipObject',
    'items', v_snapshot->'items',
    'total', v_snapshot->'total',
    'commercialTerms', v_snapshot->'commercialTerms',
    'contractConditions', v_snapshot->'contractConditions',
    'responsibilities', v_snapshot->'responsibilities',
    'content', v_snapshot->'content',
    'requiredSignatories', v_snapshot->'requiredSignatories',
    'publishedAt', v_snapshot->'publishedAt'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.proposal_public_resolve_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proposal_public_resolve_by_token(text) TO anon, authenticated;