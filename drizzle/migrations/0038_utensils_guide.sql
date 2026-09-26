-- Guia de utensílios (estrutura genérica: utensilios | enxoval)
CREATE TABLE public.guide_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_type text NOT NULL DEFAULT 'utensilios' CHECK (guide_type IN ('utensilios','enxoval')),
  category text NOT NULL CHECK (char_length(btrim(category)) BETWEEN 1 AND 60),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  recommended_quantity integer NOT NULL DEFAULT 1 CHECK (recommended_quantity >= 0),
  quantity_text text,
  description text,
  tip text,
  purchase_url text CHECK (purchase_url IS NULL OR purchase_url ~* '^https?://'),
  image_path text,
  classification text NOT NULL DEFAULT 'recomendado' CHECK (classification IN ('essencial','recomendado','opcional')),
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_catalog_items TO authenticated;
GRANT ALL ON public.guide_catalog_items TO service_role;
ALTER TABLE public.guide_catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe lê catálogo de guias" ON public.guide_catalog_items FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "equipe edita catálogo de guias" ON public.guide_catalog_items FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE TRIGGER guide_catalog_items_updated BEFORE UPDATE ON public.guide_catalog_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.implementation_guide_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  guide_type text NOT NULL DEFAULT 'utensilios' CHECK (guide_type IN ('utensilios','enxoval')),
  catalog_item_id uuid REFERENCES public.guide_catalog_items(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (char_length(btrim(category)) BETWEEN 1 AND 60),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  recommended_quantity integer NOT NULL DEFAULT 1 CHECK (recommended_quantity >= 0),
  quantity_text text,
  description text,
  tip text,
  purchase_url text CHECK (purchase_url IS NULL OR purchase_url ~* '^https?://'),
  image_path text,
  classification text NOT NULL DEFAULT 'recomendado' CHECK (classification IN ('essencial','recomendado','opcional')),
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (implementation_id, catalog_item_id)
);
CREATE INDEX implementation_guide_items_impl_idx ON public.implementation_guide_items(implementation_id, guide_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implementation_guide_items TO authenticated;
GRANT ALL ON public.implementation_guide_items TO service_role;
ALTER TABLE public.implementation_guide_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe lê guia da implantação" ON public.implementation_guide_items FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "equipe edita guia da implantação" ON public.implementation_guide_items FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE TRIGGER implementation_guide_items_updated BEFORE UPDATE ON public.implementation_guide_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.implementation_guide_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  guide_item_id uuid NOT NULL UNIQUE REFERENCES public.implementation_guide_items(id) ON DELETE CASCADE,
  answer text NOT NULL DEFAULT 'nao_informado' CHECK (answer IN ('nao_informado','ja_tenho','ja_comprei')),
  quantity integer CHECK (quantity IS NULL OR quantity BETWEEN 0 AND 999),
  source text NOT NULL DEFAULT 'owner' CHECK (source IN ('owner','admin')),
  review_status text NOT NULL DEFAULT 'pendente' CHECK (review_status IN ('pendente','confirmado','corrigido','rejeitado')),
  confirmed_quantity integer CHECK (confirmed_quantity IS NULL OR confirmed_quantity >= 0),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  supply_item_id uuid REFERENCES public.implementation_supply_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.implementation_guide_responses TO authenticated;
GRANT ALL ON public.implementation_guide_responses TO service_role;
ALTER TABLE public.implementation_guide_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe lê respostas do guia" ON public.implementation_guide_responses FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE TRIGGER implementation_guide_responses_updated BEFORE UPDATE ON public.implementation_guide_responses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Visibilidade: novo bloco utensils_guide
ALTER TABLE public.portal_visibility_releases DROP CONSTRAINT IF EXISTS portal_visibility_releases_block_check;
DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.portal_visibility_releases'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%block%' LOOP
    EXECUTE format('ALTER TABLE public.portal_visibility_releases DROP CONSTRAINT %I', c);
  END LOOP; END $$;
ALTER TABLE public.portal_visibility_releases ADD CONSTRAINT portal_visibility_releases_block_check
  CHECK (block IN ('overview','proposal','documents','utensils_guide'));

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
  ELSIF v_block = 'utensils_guide' THEN
    IF NOT EXISTS (SELECT 1 FROM public.implementation_guide_items WHERE implementation_id = v_impl AND guide_type = 'utensilios' AND enabled) THEN
      RAISE EXCEPTION 'Aplique o guia antes de liberar.';
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

-- Aplicar catálogo à implantação (idempotente; cópia independente)
CREATE OR REPLACE FUNCTION public.admin_apply_guide(p_implementation_id uuid, p_guide_type text DEFAULT 'utensilios') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF public.has_admin_role('super_admin','admin','commercial','operations') IS NOT TRUE THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.implementation_projects WHERE id = p_implementation_id) THEN
    RAISE EXCEPTION 'implantação não encontrada';
  END IF;
  INSERT INTO public.implementation_guide_items (implementation_id, guide_type, catalog_item_id, category, name,
    recommended_quantity, quantity_text, description, tip, purchase_url, image_path, classification, display_order)
  SELECT p_implementation_id, c.guide_type, c.id, c.category, c.name, c.recommended_quantity, c.quantity_text,
    c.description, c.tip, c.purchase_url, c.image_path, c.classification, c.display_order
  FROM public.guide_catalog_items c
  WHERE c.guide_type = p_guide_type AND c.active
  ON CONFLICT (implementation_id, catalog_item_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'guide.applied', 'implementation', p_implementation_id, jsonb_build_object('guideType', p_guide_type, 'added', v_count));
  RETURN v_count;
END; $$;

-- Revisão: confirmar/corrigir/rejeitar e atualizar inventário oficial
CREATE OR REPLACE FUNCTION public.admin_review_guide_response(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resp public.implementation_guide_responses%rowtype;
  v_item public.implementation_guide_items%rowtype;
  v_action text := p_data->>'action';
  v_qty integer;
  v_supply uuid;
BEGIN
  IF public.has_admin_role('super_admin','admin','commercial','operations') IS NOT TRUE THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_resp FROM public.implementation_guide_responses WHERE id = (p_data->>'responseId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'resposta não encontrada'; END IF;
  SELECT * INTO v_item FROM public.implementation_guide_items WHERE id = v_resp.guide_item_id;

  IF v_action = 'reject' THEN
    UPDATE public.implementation_guide_responses SET review_status = 'rejeitado', reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = left(nullif(btrim(coalesce(p_data->>'note','')),''),500) WHERE id = v_resp.id;
    INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'guide.response_rejected', 'implementation', v_resp.implementation_id, jsonb_build_object('responseId', v_resp.id));
    RETURN jsonb_build_object('status', 'rejeitado');
  END IF;
  IF v_action NOT IN ('confirm','correct') THEN RAISE EXCEPTION 'ação inválida'; END IF;
  v_qty := CASE WHEN v_action = 'correct' THEN (p_data->>'quantity')::integer ELSE coalesce(v_resp.quantity, 0) END;
  IF v_qty IS NULL OR v_qty < 0 OR v_qty > 999 THEN RAISE EXCEPTION 'quantidade inválida'; END IF;

  v_supply := v_resp.supply_item_id;
  IF v_supply IS NULL THEN
    SELECT id INTO v_supply FROM public.implementation_supply_items
    WHERE implementation_id = v_resp.implementation_id AND module = 'faltante' AND lower(name) = lower(v_item.name) LIMIT 1;
  END IF;
  IF v_supply IS NULL THEN
    INSERT INTO public.implementation_supply_items (implementation_id, module, name, room, required_qty, existing_qty,
      status, priority, responsible, blocks_readiness, display_order)
    VALUES (v_resp.implementation_id, 'faltante', v_item.name, v_item.category, v_item.recommended_quantity, v_qty,
      CASE WHEN v_qty >= v_item.recommended_quantity THEN 'instalado'::supply_status ELSE 'pendente'::supply_status END,
      CASE WHEN v_item.classification = 'essencial' THEN 'alta'::supply_priority ELSE 'media'::supply_priority END,
      'proprietario', false,
      coalesce((SELECT max(display_order) + 1 FROM public.implementation_supply_items WHERE implementation_id = v_resp.implementation_id), 1))
    RETURNING id INTO v_supply;
  ELSE
    UPDATE public.implementation_supply_items SET required_qty = v_item.recommended_quantity, existing_qty = v_qty,
      status = CASE WHEN v_qty >= v_item.recommended_quantity THEN 'instalado'::supply_status
                    WHEN status = 'instalado'::supply_status THEN 'pendente'::supply_status ELSE status END
    WHERE id = v_supply;
  END IF;

  UPDATE public.implementation_guide_responses SET
    review_status = CASE WHEN v_action = 'correct' THEN 'corrigido' ELSE 'confirmado' END,
    confirmed_quantity = v_qty, reviewed_by = auth.uid(), reviewed_at = now(), supply_item_id = v_supply,
    review_note = left(nullif(btrim(coalesce(p_data->>'note','')),''),500)
  WHERE id = v_resp.id;
  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), CASE WHEN v_action = 'correct' THEN 'guide.response_corrected' ELSE 'guide.response_confirmed' END,
    'implementation', v_resp.implementation_id,
    jsonb_build_object('responseId', v_resp.id, 'supplyItemId', v_supply, 'quantity', v_qty));
  RETURN jsonb_build_object('status', 'ok', 'supplyItemId', v_supply);
END; $$;

-- Portal: leitura e resposta pelo token do convite do proprietário
CREATE OR REPLACE FUNCTION public.owner_guide_resolve(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_impl uuid;
BEGIN
  v_impl := public.owner_suppliers_invitation(p_token);
  IF v_impl IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.portal_visibility_releases WHERE implementation_id = v_impl AND block = 'utensils_guide' AND revoked_at IS NULL) THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('items', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', i.id, 'category', i.category, 'name', i.name, 'recommendedQuantity', i.recommended_quantity,
      'quantityText', i.quantity_text, 'description', i.description, 'tip', i.tip, 'purchaseUrl', i.purchase_url,
      'hasImage', i.image_path IS NOT NULL, 'classification', i.classification,
      'answer', coalesce(r.answer, 'nao_informado'), 'quantity', r.quantity,
      'reviewStatus', r.review_status
    ) ORDER BY i.category, i.display_order, i.name)
    FROM public.implementation_guide_items i
    LEFT JOIN public.implementation_guide_responses r ON r.guide_item_id = i.id
    WHERE i.implementation_id = v_impl AND i.guide_type = 'utensilios' AND i.enabled), '[]'::jsonb));
END; $$;

CREATE OR REPLACE FUNCTION public.owner_guide_image_paths(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_impl uuid;
BEGIN
  v_impl := public.owner_suppliers_invitation(p_token);
  IF v_impl IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_visibility_releases WHERE implementation_id = v_impl AND block = 'utensils_guide' AND revoked_at IS NULL) THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN coalesce((SELECT jsonb_object_agg(i.id, i.image_path) FROM public.implementation_guide_items i
    WHERE i.implementation_id = v_impl AND i.guide_type = 'utensilios' AND i.enabled AND i.image_path IS NOT NULL), '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_guide_save(p_token text, p_item_id uuid, p_answer text, p_quantity integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_impl uuid; v_prev text;
BEGIN
  v_impl := public.owner_suppliers_invitation(p_token);
  IF v_impl IS NULL THEN RAISE EXCEPTION 'link inválido ou expirado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.portal_visibility_releases WHERE implementation_id = v_impl AND block = 'utensils_guide' AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'guia indisponível';
  END IF;
  IF p_answer NOT IN ('nao_informado','ja_tenho','ja_comprei') THEN RAISE EXCEPTION 'resposta inválida'; END IF;
  IF p_quantity IS NOT NULL AND (p_quantity < 0 OR p_quantity > 999) THEN RAISE EXCEPTION 'quantidade inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.implementation_guide_items WHERE id = p_item_id AND implementation_id = v_impl AND enabled) THEN
    RAISE EXCEPTION 'item não encontrado';
  END IF;
  SELECT answer INTO v_prev FROM public.implementation_guide_responses WHERE guide_item_id = p_item_id;
  INSERT INTO public.implementation_guide_responses (implementation_id, guide_item_id, answer, quantity, source, review_status)
  VALUES (v_impl, p_item_id, p_answer, CASE WHEN p_answer = 'nao_informado' THEN NULL ELSE p_quantity END, 'owner', 'pendente')
  ON CONFLICT (guide_item_id) DO UPDATE SET answer = excluded.answer, quantity = excluded.quantity, source = 'owner',
    review_status = 'pendente', reviewed_by = NULL, reviewed_at = NULL;
  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (NULL, CASE WHEN v_prev IS NULL THEN 'guide.owner_answered' ELSE 'guide.owner_answer_changed' END, 'implementation', v_impl,
    jsonb_build_object('guideItemId', p_item_id, 'answer', p_answer, 'quantity', p_quantity));
  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE ALL ON FUNCTION public.admin_apply_guide(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_guide_response(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_guide(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_guide_response(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_guide_resolve(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_guide_save(text, uuid, text, integer) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_guide_image_paths(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_guide_image_paths(text) TO service_role;

-- Storage: bucket privado guide-images
CREATE POLICY "equipe lê imagens de guias" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'guide-images' AND public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "equipe envia imagens de guias" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guide-images' AND public.has_admin_role('super_admin','admin','commercial','operations')
    AND (storage.foldername(name))[1] IN ('catalog','implementations'));
CREATE POLICY "equipe altera imagens de guias" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'guide-images' AND public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE POLICY "equipe remove imagens de guias" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'guide-images' AND public.has_admin_role('super_admin','admin','commercial','operations'));