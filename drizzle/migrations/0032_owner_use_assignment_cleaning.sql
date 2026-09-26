ALTER TABLE public.implementation_contract_conditions
  ADD COLUMN IF NOT EXISTS initial_cleaning_fee numeric,
  ADD COLUMN IF NOT EXISTS owner_use_limit_mode text,
  ADD COLUMN IF NOT EXISTS owner_use_limit_days integer,
  ADD COLUMN IF NOT EXISTS owner_use_limit_period text,
  ADD COLUMN IF NOT EXISTS owner_use_notice_days integer,
  ADD COLUMN IF NOT EXISTS owner_use_notes text,
  ADD COLUMN IF NOT EXISTS assignment_mode text,
  ADD COLUMN IF NOT EXISTS assignment_who text,
  ADD COLUMN IF NOT EXISTS assignment_procedure text,
  ADD COLUMN IF NOT EXISTS assignment_notice_days integer;
COMMENT ON COLUMN public.implementation_contract_conditions.turnover_cleaning_fee IS 'Valor da limpeza comercial do imóvel (hospedagens, uso próprio e cessão). Publicado também como commercialCleaningFee.';
COMMENT ON COLUMN public.implementation_contract_conditions.owner_use_notice_days IS 'Antecedência mínima em dias; NULL = a decidir.';
ALTER TABLE public.implementation_contract_conditions DROP CONSTRAINT IF EXISTS icc_initial_cleaning_option_chk;
ALTER TABLE public.implementation_contract_conditions ADD CONSTRAINT icc_initial_cleaning_option_chk CHECK (initial_cleaning_option IS NULL OR initial_cleaning_option IN ('owner_delivers','stayo_initial','stayo_post_construction','other','tbd'));
ALTER TABLE public.implementation_contract_conditions ADD CONSTRAINT icc_owner_use_limit_mode_chk CHECK (owner_use_limit_mode IS NULL OR owner_use_limit_mode IN ('unlimited','limited','tbd'));
ALTER TABLE public.implementation_contract_conditions ADD CONSTRAINT icc_assignment_mode_chk CHECK (assignment_mode IS NULL OR assignment_mode IN ('allowed','not_allowed','tbd'));
ALTER TABLE public.implementation_contract_conditions ADD CONSTRAINT icc_new_numbers_chk CHECK ((initial_cleaning_fee IS NULL OR initial_cleaning_fee >= 0) AND (owner_use_limit_days IS NULL OR owner_use_limit_days >= 0) AND (owner_use_notice_days IS NULL OR owner_use_notice_days >= 0) AND (assignment_notice_days IS NULL OR assignment_notice_days >= 0));

CREATE OR REPLACE FUNCTION public.admin_publish_proposal(p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        'noticePeriodDays', cc.notice_period_days,
        'initialCleaningOption', cc.initial_cleaning_option,
        'initialCleaningOther', cc.initial_cleaning_other,
        'initialCleaningCostBearer', cc.initial_cleaning_cost_bearer,
        'turnoverCleaningTeam', cc.turnover_cleaning_team,
        'turnoverCleaningFee', cc.turnover_cleaning_fee,
        'turnoverCleaningPayer', cc.turnover_cleaning_payer,
        'commercialCleaningFee', cc.turnover_cleaning_fee,
        'initialCleaningFee', cc.initial_cleaning_fee,
        'ownerUseLimitMode', cc.owner_use_limit_mode,
        'ownerUseLimitDays', cc.owner_use_limit_days,
        'ownerUseLimitPeriod', cc.owner_use_limit_period,
        'ownerUseNoticeDays', cc.owner_use_notice_days,
        'ownerUseNotes', cc.owner_use_notes,
        'assignmentMode', cc.assignment_mode,
        'assignmentWho', cc.assignment_who,
        'assignmentProcedure', cc.assignment_procedure,
        'assignmentNoticeDays', cc.assignment_notice_days
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
$function$;