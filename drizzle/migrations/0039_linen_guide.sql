-- Guia de enxoval: mesma infraestrutura dos guias, bloco de visibilidade próprio
ALTER TABLE public.guide_catalog_items ADD COLUMN IF NOT EXISTS size_text text;
ALTER TABLE public.implementation_guide_items ADD COLUMN IF NOT EXISTS size_text text;

ALTER TABLE public.portal_visibility_releases DROP CONSTRAINT IF EXISTS portal_visibility_releases_block_check;
ALTER TABLE public.portal_visibility_releases ADD CONSTRAINT portal_visibility_releases_block_check
  CHECK (block IN ('overview','proposal','documents','utensils_guide','guia_enxoval'));

CREATE OR REPLACE FUNCTION public.guide_block_for(p_guide_type text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_guide_type WHEN 'utensilios' THEN 'utensils_guide' WHEN 'enxoval' THEN 'guia_enxoval' END
$$;

CREATE OR REPLACE FUNCTION public.admin_release_portal_block(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_impl uuid := (p_data->>'implementationId')::uuid;
  v_block text := p_data->>'block';
  v_content jsonb;
  v_snapshot jsonb;
  v_name text;
  v_id uuid;
BEGIN
  IF NOT public.has_admin_role('super_admin','admin','commercial','operations') THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  IF v_block = 'overview' THEN
    IF length(btrim(coalesce(p_data#>>'{content,message}',''))) < 3 THEN RAISE EXCEPTION 'Escreva a mensagem do resumo.'; END IF;
    v_content := jsonb_build_object(
      'title', left(btrim(coalesce(p_data#>>'{content,title}','Resumo da implantação')),120),
      'message', left(btrim(p_data#>>'{content,message}'),1200),
      'nextStep', left(nullif(btrim(coalesce(p_data#>>'{content,nextStep}','')),''),300));
  ELSIF v_block = 'proposal' THEN
    SELECT snapshot INTO v_snapshot FROM public.proposals
    WHERE id = (p_data#>>'{content,proposalId}')::uuid AND implementation_id = v_impl
      AND snapshot IS NOT NULL AND status IN ('published','accepted');
    IF v_snapshot IS NULL THEN RAISE EXCEPTION 'Versão publicada não encontrada nesta oportunidade.'; END IF;
    v_content := jsonb_build_object('proposalId', p_data#>>'{content,proposalId}', 'snapshot', v_snapshot);
  ELSIF v_block = 'documents' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('attachmentId', a.id, 'filename', a.filename, 'mimeType', a.mime_type, 'category', a.category, 'createdAt', a.created_at) ORDER BY a.created_at DESC), '[]'::jsonb)
    INTO v_content
    FROM public.attachments a
    WHERE a.implementation_id = v_impl
      AND a.id IN (SELECT (jsonb_array_elements_text(coalesce(p_data#>'{content,attachmentIds}','[]'::jsonb)))::uuid);
    IF jsonb_array_length(v_content) = 0 THEN RAISE EXCEPTION 'Selecione ao menos um documento.'; END IF;
    v_content := jsonb_build_object('documents', v_content);
  ELSIF v_block IN ('utensils_guide','guia_enxoval') THEN
    IF NOT EXISTS (SELECT 1 FROM public.implementation_guide_items WHERE implementation_id = v_impl
      AND guide_type = CASE v_block WHEN 'utensils_guide' THEN 'utensilios' ELSE 'enxoval' END AND enabled) THEN
      RAISE EXCEPTION 'Adicione itens ao guia antes de liberar.';
    END IF;
    v_content := '{}'::jsonb;
  ELSE
    RAISE EXCEPTION 'bloco inválido';
  END IF;

  SELECT full_name INTO v_name FROM public.admin_profiles WHERE id = auth.uid();
  UPDATE public.portal_visibility_releases SET revoked_at = now(), revoked_by = auth.uid()
  WHERE implementation_id = v_impl AND block = v_block AND revoked_at IS NULL;
  INSERT INTO public.portal_visibility_releases (implementation_id, block, content, released_by, released_by_name)
  VALUES (v_impl, v_block, v_content, auth.uid(), v_name) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'portal.block_released', 'implementation', v_impl, jsonb_build_object('block', v_block, 'releaseId', v_id));
  RETURN jsonb_build_object('id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_apply_guide(p_implementation_id uuid, p_guide_type text DEFAULT 'utensilios') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF public.has_admin_role('super_admin','admin','commercial','operations') IS NOT TRUE THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  IF p_guide_type NOT IN ('utensilios','enxoval') THEN RAISE EXCEPTION 'tipo de guia inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.implementation_projects WHERE id = p_implementation_id) THEN
    RAISE EXCEPTION 'implantação não encontrada';
  END IF;
  INSERT INTO public.implementation_guide_items (implementation_id, guide_type, catalog_item_id, category, name,
    recommended_quantity, quantity_text, size_text, description, tip, purchase_url, image_path, classification, display_order)
  SELECT p_implementation_id, c.guide_type, c.id, c.category, c.name, c.recommended_quantity, c.quantity_text, c.size_text,
    c.description, c.tip, c.purchase_url, c.image_path, c.classification, c.display_order
  FROM public.guide_catalog_items c
  WHERE c.guide_type = p_guide_type AND c.active
  ON CONFLICT (implementation_id, catalog_item_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'guide.applied', 'implementation', p_implementation_id, jsonb_build_object('guideType', p_guide_type, 'added', v_count));
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.owner_guide_resolve(p_token text, p_guide_type text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_impl uuid;
BEGIN
  IF p_guide_type NOT IN ('utensilios','enxoval') THEN RETURN NULL; END IF;
  v_impl := public.owner_suppliers_invitation(p_token);
  IF v_impl IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.portal_visibility_releases WHERE implementation_id = v_impl
    AND block = public.guide_block_for(p_guide_type) AND revoked_at IS NULL) THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('items', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', i.id, 'category', i.category, 'name', i.name, 'recommendedQuantity', i.recommended_quantity,
      'quantityText', i.quantity_text, 'sizeText', i.size_text, 'description', i.description, 'tip', i.tip,
      'purchaseUrl', i.purchase_url, 'hasImage', i.image_path IS NOT NULL, 'classification', i.classification,
      'answer', coalesce(r.answer, 'nao_informado'), 'quantity', r.quantity, 'reviewStatus', r.review_status
    ) ORDER BY i.category, i.display_order, i.name)
    FROM public.implementation_guide_items i
    LEFT JOIN public.implementation_guide_responses r ON r.guide_item_id = i.id
    WHERE i.implementation_id = v_impl AND i.guide_type = p_guide_type AND i.enabled), '[]'::jsonb));
END; $$;

CREATE OR REPLACE FUNCTION public.owner_guide_resolve(p_token text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT public.owner_guide_resolve(p_token, 'utensilios') $$;

CREATE OR REPLACE FUNCTION public.owner_guide_image_paths(p_token text, p_guide_type text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_impl uuid;
BEGIN
  v_impl := public.owner_suppliers_invitation(p_token);
  IF v_impl IS NULL OR p_guide_type NOT IN ('utensilios','enxoval') OR NOT EXISTS (SELECT 1 FROM public.portal_visibility_releases
    WHERE implementation_id = v_impl AND block = public.guide_block_for(p_guide_type) AND revoked_at IS NULL) THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN coalesce((SELECT jsonb_object_agg(i.id, i.image_path) FROM public.implementation_guide_items i
    WHERE i.implementation_id = v_impl AND i.guide_type = p_guide_type AND i.enabled AND i.image_path IS NOT NULL), '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_guide_save(p_token text, p_item_id uuid, p_answer text, p_quantity integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_impl uuid; v_prev text; v_type text;
BEGIN
  v_impl := public.owner_suppliers_invitation(p_token);
  IF v_impl IS NULL THEN RAISE EXCEPTION 'link inválido ou expirado'; END IF;
  IF p_answer NOT IN ('nao_informado','ja_tenho','ja_comprei') THEN RAISE EXCEPTION 'resposta inválida'; END IF;
  IF p_quantity IS NOT NULL AND (p_quantity < 0 OR p_quantity > 999) THEN RAISE EXCEPTION 'quantidade inválida'; END IF;
  SELECT guide_type INTO v_type FROM public.implementation_guide_items WHERE id = p_item_id AND implementation_id = v_impl AND enabled;
  IF v_type IS NULL THEN RAISE EXCEPTION 'item não encontrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.portal_visibility_releases WHERE implementation_id = v_impl
    AND block = public.guide_block_for(v_type) AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'guia indisponível';
  END IF;
  SELECT answer INTO v_prev FROM public.implementation_guide_responses WHERE guide_item_id = p_item_id;
  INSERT INTO public.implementation_guide_responses (implementation_id, guide_item_id, answer, quantity, source, review_status)
  VALUES (v_impl, p_item_id, p_answer, CASE WHEN p_answer = 'nao_informado' THEN NULL ELSE p_quantity END, 'owner', 'pendente')
  ON CONFLICT (guide_item_id) DO UPDATE SET answer = excluded.answer, quantity = excluded.quantity, source = 'owner',
    review_status = 'pendente', reviewed_by = NULL, reviewed_at = NULL;
  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (NULL, CASE WHEN v_prev IS NULL THEN 'guide.owner_answered' ELSE 'guide.owner_answer_changed' END, 'implementation', v_impl,
    jsonb_build_object('guideItemId', p_item_id, 'guideType', v_type, 'answer', p_answer, 'quantity', p_quantity));
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.owner_guide_resolve(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_guide_image_paths(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_guide_image_paths(text, text) TO service_role;