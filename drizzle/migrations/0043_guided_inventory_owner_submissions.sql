-- Inventário guiado: participação do proprietário por sessão autenticada + revisão STAYO.
-- Proprietário nunca grava no item: envia propostas que só viram verdade após revisão.

-- 1) Estado de validação do item: só STAYO preenche ou revisa.
ALTER TABLE public.implementation_guide_items DROP CONSTRAINT IF EXISTS implementation_guide_items_inventory_review_status_check;
UPDATE public.implementation_guide_items SET inventory_review_status = 'preenchido_stayo'
  WHERE inventory_review_status IN ('aprovado','em_revisao');
ALTER TABLE public.implementation_guide_items ALTER COLUMN inventory_review_status SET DEFAULT 'preenchido_stayo';
ALTER TABLE public.implementation_guide_items ADD CONSTRAINT implementation_guide_items_inventory_review_status_check
  CHECK (inventory_review_status IN ('preenchido_stayo','revisado_stayo'));

-- 2) Submissões do proprietário (trilha de revisão).
CREATE TABLE public.implementation_inventory_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.implementation_guide_items(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('item','novo_item')),
  proposed jsonb NOT NULL,
  previous jsonb,
  applied jsonb,
  submitted_by uuid NOT NULL,
  owner_id uuid REFERENCES public.owner_records(id),
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','aprovado','ajustado','complemento_solicitado')),
  owner_message text CHECK (owner_message IS NULL OR char_length(owner_message) <= 500),
  decision_internal_note text CHECK (decision_internal_note IS NULL OR char_length(decision_internal_note) <= 1000),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX implementation_inventory_submissions_impl_idx ON public.implementation_inventory_submissions (implementation_id, status);
CREATE INDEX implementation_inventory_submissions_item_idx ON public.implementation_inventory_submissions (item_id);

GRANT SELECT ON public.implementation_inventory_submissions TO authenticated;
GRANT ALL ON public.implementation_inventory_submissions TO service_role;
ALTER TABLE public.implementation_inventory_submissions ENABLE ROW LEVEL SECURITY;
-- Só a equipe lê diretamente; proprietário acessa apenas pelas RPCs abaixo; ninguém grava direto.
CREATE POLICY "equipe lê submissões do inventário" ON public.implementation_inventory_submissions
  FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));

-- 3) Leitura segura do proprietário (sem notas internas, autores ou terceiros).
CREATE OR REPLACE FUNCTION public.owner_inventory_resolve(p_implementation_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.owner_can_access_implementation(p_implementation_id) THEN
    RAISE EXCEPTION 'sem acesso' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'implementation', (SELECT jsonb_build_object('id', ip.id, 'code', ip.code, 'nickname', ip.nickname,
        'condominiumName', ip.condominium_name, 'unit', ip.unit)
      FROM public.implementation_projects ip WHERE ip.id = p_implementation_id),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', g.id, 'room', g.room, 'name', g.name, 'category', g.category, 'tip', g.tip,
        'displayOrder', g.display_order, 'recommended', g.catalog_item_id IS NOT NULL,
        'source', g.inventory_source, 'reviewStatus', g.inventory_review_status,
        'answer', g.inventory_answer, 'quantity', g.inventory_quantity,
        'brand', g.inventory_brand, 'condition', g.inventory_condition) ORDER BY g.room, g.display_order)
      FROM public.implementation_guide_items g
      WHERE g.implementation_id = p_implementation_id AND g.guide_type = 'inventario' AND g.enabled), '[]'::jsonb),
    'submissions', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'itemId', s.item_id, 'kind', s.kind, 'proposed', s.proposed,
        'status', s.status, 'ownerMessage', s.owner_message, 'updatedAt', s.updated_at) ORDER BY s.updated_at)
      FROM public.implementation_inventory_submissions s
      WHERE s.implementation_id = p_implementation_id AND s.submitted_by = auth.uid()
        AND s.status IN ('enviado','complemento_solicitado')), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;

-- 4) Envio do proprietário: whitelist de campos; substitui o próprio envio ainda aberto.
CREATE OR REPLACE FUNCTION public.owner_inventory_submit(p_implementation_id uuid, p_item_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid; v_kind text; v_prev jsonb; v_prop jsonb; v_id uuid;
  v_answer text := nullif(p_data->>'answer','');
  v_qty text := nullif(p_data->>'quantity','');
  v_brand text := nullif(btrim(coalesce(p_data->>'brand','')),'');
  v_cond text := nullif(p_data->>'condition','');
  v_note text := nullif(btrim(coalesce(p_data->>'note','')),'');
  v_name text := nullif(btrim(coalesce(p_data->>'name','')),'');
  v_room text := nullif(p_data->>'room','');
BEGIN
  IF auth.uid() IS NULL OR NOT public.owner_can_access_implementation(p_implementation_id) THEN
    RAISE EXCEPTION 'sem acesso' USING ERRCODE = '42501';
  END IF;
  SELECT owner_id INTO v_owner FROM public.owner_portal_accounts WHERE id = auth.uid();
  IF v_answer IS NOT NULL AND v_answer NOT IN ('tenho','nao_tenho','nao_aplica') THEN RAISE EXCEPTION 'resposta inválida'; END IF;
  IF v_qty IS NOT NULL AND (v_qty !~ '^\d{1,4}$') THEN RAISE EXCEPTION 'quantidade inválida'; END IF;
  IF v_cond IS NOT NULL AND v_cond NOT IN ('bom','atencao','danificado') THEN RAISE EXCEPTION 'estado inválido'; END IF;
  IF char_length(coalesce(v_brand,'')) > 80 OR char_length(coalesce(v_note,'')) > 500 OR char_length(coalesce(v_name,'')) > 120 THEN
    RAISE EXCEPTION 'texto longo demais';
  END IF;

  IF p_item_id IS NULL THEN
    v_kind := 'novo_item';
    IF v_name IS NULL THEN RAISE EXCEPTION 'Informe o nome do item'; END IF;
    IF v_room IS NULL OR v_room NOT IN ('cozinha','sala','quartos','banheiros','lavanderia','externa','outros') THEN RAISE EXCEPTION 'ambiente inválido'; END IF;
  ELSE
    v_kind := 'item';
    SELECT jsonb_build_object('answer', inventory_answer, 'quantity', inventory_quantity, 'brand', inventory_brand,
      'condition', inventory_condition, 'name', name, 'room', room)
      INTO v_prev FROM public.implementation_guide_items
      WHERE id = p_item_id AND implementation_id = p_implementation_id AND guide_type = 'inventario' AND enabled;
    IF v_prev IS NULL THEN RAISE EXCEPTION 'item não encontrado' USING ERRCODE = '42501'; END IF;
    v_name := NULL; v_room := NULL;
  END IF;

  v_prop := jsonb_strip_nulls(jsonb_build_object('answer', v_answer, 'quantity', v_qty::int, 'brand', v_brand,
    'condition', v_cond, 'note', v_note, 'name', v_name, 'room', v_room));

  IF p_item_id IS NOT NULL THEN
    UPDATE public.implementation_inventory_submissions
      SET proposed = v_prop, previous = v_prev, status = 'enviado', updated_at = now()
      WHERE implementation_id = p_implementation_id AND item_id = p_item_id AND submitted_by = auth.uid()
        AND status IN ('enviado','complemento_solicitado')
      RETURNING id INTO v_id;
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.implementation_inventory_submissions (implementation_id, item_id, kind, proposed, previous, submitted_by, owner_id)
      VALUES (p_implementation_id, p_item_id, v_kind, v_prop, v_prev, auth.uid(), v_owner)
      RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'status', 'enviado');
END $$;

-- 5) Revisão STAYO: aprovar, ajustar ou pedir complemento, com trilha completa.
CREATE OR REPLACE FUNCTION public.admin_review_inventory_submission(p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  s public.implementation_inventory_submissions;
  v_decision text := p_data->>'decision';
  v_vals jsonb; v_prev jsonb; v_item uuid; v_room text; v_name text;
BEGIN
  IF NOT public.has_admin_role('super_admin','admin','commercial','operations') THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM public.implementation_inventory_submissions WHERE id = (p_data->>'submissionId')::uuid FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'envio não encontrado'; END IF;
  IF s.status <> 'enviado' THEN RAISE EXCEPTION 'envio já decidido'; END IF;
  IF v_decision NOT IN ('aprovar','ajustar','complemento') THEN RAISE EXCEPTION 'decisão inválida'; END IF;

  IF v_decision = 'complemento' THEN
    IF length(btrim(coalesce(p_data->>'ownerMessage',''))) < 3 THEN RAISE EXCEPTION 'Escreva o que falta para o proprietário.'; END IF;
    UPDATE public.implementation_inventory_submissions SET status = 'complemento_solicitado',
      owner_message = left(btrim(p_data->>'ownerMessage'),500),
      decision_internal_note = left(nullif(btrim(coalesce(p_data->>'internalNote','')),''),1000),
      decided_by = auth.uid(), decided_at = now(), updated_at = now() WHERE id = s.id;
  ELSE
    v_vals := CASE WHEN v_decision = 'ajustar' THEN coalesce(p_data->'values','{}'::jsonb) ELSE s.proposed END;
    IF v_vals ? 'answer' AND nullif(v_vals->>'answer','') IS NOT NULL AND v_vals->>'answer' NOT IN ('tenho','nao_tenho','nao_aplica') THEN RAISE EXCEPTION 'resposta inválida'; END IF;
    IF nullif(v_vals->>'condition','') IS NOT NULL AND v_vals->>'condition' NOT IN ('bom','atencao','danificado') THEN RAISE EXCEPTION 'estado inválido'; END IF;
    IF s.kind = 'novo_item' THEN
      v_name := left(btrim(coalesce(nullif(v_vals->>'name',''), s.proposed->>'name')),120);
      v_room := coalesce(nullif(v_vals->>'room',''), s.proposed->>'room');
      INSERT INTO public.implementation_guide_items (implementation_id, guide_type, room, category, name,
        recommended_quantity, classification, display_order, inventory_source, inventory_review_status,
        inventory_answer, inventory_quantity, inventory_brand, inventory_condition, inventory_answered_at, inventory_answered_by)
      VALUES (s.implementation_id, 'inventario', v_room, 'Informado pelo proprietário', v_name, 1, 'recomendado', 2000,
        'proprietario', 'revisado_stayo', nullif(v_vals->>'answer',''), nullif(v_vals->>'quantity','')::int,
        nullif(v_vals->>'brand',''), nullif(v_vals->>'condition',''),
        CASE WHEN nullif(v_vals->>'answer','') IS NOT NULL THEN now() END,
        CASE WHEN nullif(v_vals->>'answer','') IS NOT NULL THEN auth.uid() END)
      RETURNING id INTO v_item;
    ELSE
      IF s.item_id IS NULL THEN RAISE EXCEPTION 'item removido; não é possível aplicar'; END IF;
      SELECT jsonb_build_object('answer', inventory_answer, 'quantity', inventory_quantity, 'brand', inventory_brand,
        'condition', inventory_condition) INTO v_prev FROM public.implementation_guide_items WHERE id = s.item_id;
      UPDATE public.implementation_guide_items SET
        inventory_answer = CASE WHEN v_vals ? 'answer' THEN nullif(v_vals->>'answer','') ELSE inventory_answer END,
        inventory_answered_at = CASE WHEN v_vals ? 'answer' THEN now() ELSE inventory_answered_at END,
        inventory_answered_by = CASE WHEN v_vals ? 'answer' THEN auth.uid() ELSE inventory_answered_by END,
        inventory_quantity = CASE WHEN v_vals ? 'quantity' THEN nullif(v_vals->>'quantity','')::int ELSE inventory_quantity END,
        inventory_brand = CASE WHEN v_vals ? 'brand' THEN nullif(v_vals->>'brand','') ELSE inventory_brand END,
        inventory_condition = CASE WHEN v_vals ? 'condition' THEN nullif(v_vals->>'condition','') ELSE inventory_condition END,
        inventory_review_status = 'revisado_stayo'
      WHERE id = s.item_id;
      v_item := s.item_id;
    END IF;
    UPDATE public.implementation_inventory_submissions SET
      status = CASE v_decision WHEN 'aprovar' THEN 'aprovado' ELSE 'ajustado' END,
      item_id = v_item, applied = v_vals, previous = coalesce(v_prev, s.previous),
      decision_internal_note = left(nullif(btrim(coalesce(p_data->>'internalNote','')),''),1000),
      decided_by = auth.uid(), decided_at = now(), updated_at = now() WHERE id = s.id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'inventory_submission_' || v_decision, 'implementation_inventory_submission', s.id,
    jsonb_build_object('implementationId', s.implementation_id, 'itemId', coalesce(v_item, s.item_id),
      'previous', coalesce(v_prev, s.previous), 'proposed', s.proposed, 'applied', v_vals));
  RETURN jsonb_build_object('id', s.id, 'decision', v_decision, 'itemId', coalesce(v_item, s.item_id));
END $$;

REVOKE ALL ON FUNCTION public.owner_inventory_resolve(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_inventory_submit(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_inventory_submission(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_inventory_resolve(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_inventory_submit(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_inventory_submission(jsonb) TO authenticated;