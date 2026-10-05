CREATE OR REPLACE FUNCTION public.owner_inventory_token_ctx(p_token text, OUT o_impl uuid, OUT o_inv uuid, OUT o_owner uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN RAISE EXCEPTION 'acesso inválido' USING ERRCODE='42501'; END IF;
  SELECT i.implementation_id, i.id, i.owner_id INTO o_impl, o_inv, o_owner FROM public.owner_portal_invitations i
   WHERE i.token_hash = encode(digest(p_token,'sha256'),'hex') AND i.revoked_at IS NULL AND i.expires_at >= now();
  IF o_impl IS NULL THEN RAISE EXCEPTION 'acesso inválido' USING ERRCODE='42501'; END IF;
  IF NOT public.owner_journey_current_confirmed(o_impl) THEN RAISE EXCEPTION 'proposta não confirmada' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.owner_inventory_token_ctx(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_inventory_resolve_by_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM public.owner_inventory_token_ctx(p_token);
  RETURN jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', g.id, 'room', g.room, 'name', g.name, 'category', g.category, 'tip', g.tip,
        'description', g.description,
        'purchaseUrl', CASE WHEN g.purchase_url ~* '^https?://' THEN g.purchase_url END,
        'hasImage', g.image_path IS NOT NULL, 'displayOrder', g.display_order,
        'answer', g.inventory_answer, 'quantity', g.inventory_quantity) ORDER BY g.room, g.display_order)
      FROM public.implementation_guide_items g
      WHERE g.implementation_id = c.o_impl AND g.guide_type = 'inventario' AND g.enabled), '[]'::jsonb),
    'submissions', coalesce((SELECT jsonb_agg(jsonb_build_object('itemId', s.item_id, 'proposed', s.proposed, 'status', s.status))
      FROM public.implementation_inventory_submissions s
      WHERE s.implementation_id = c.o_impl AND s.submitted_by = c.o_inv AND s.item_id IS NOT NULL
        AND s.status IN ('enviado','complemento_solicitado')), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.owner_inventory_submit_by_token(p_token text, p_item_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; v_prev jsonb; v_prop jsonb; v_id uuid;
  v_answer text := nullif(p_data->>'answer','');
  v_note text := nullif(btrim(coalesce(p_data->>'note','')),'');
BEGIN
  SELECT * INTO c FROM public.owner_inventory_token_ctx(p_token);
  IF v_answer IS NOT NULL AND v_answer NOT IN ('tenho','nao_tenho','nao_aplica') THEN RAISE EXCEPTION 'resposta inválida'; END IF;
  IF char_length(coalesce(v_note,'')) > 500 THEN RAISE EXCEPTION 'texto longo demais'; END IF;
  SELECT jsonb_build_object('answer', inventory_answer, 'quantity', inventory_quantity, 'brand', inventory_brand,
      'condition', inventory_condition, 'name', name, 'room', room)
    INTO v_prev FROM public.implementation_guide_items
   WHERE id = p_item_id AND implementation_id = c.o_impl AND guide_type = 'inventario' AND enabled;
  IF v_prev IS NULL THEN RAISE EXCEPTION 'item não encontrado' USING ERRCODE='42501'; END IF;
  v_prop := jsonb_strip_nulls(jsonb_build_object('answer', v_answer, 'note', v_note));
  UPDATE public.implementation_inventory_submissions
     SET proposed = v_prop, previous = v_prev, status = 'enviado', updated_at = now()
   WHERE implementation_id = c.o_impl AND item_id = p_item_id AND submitted_by = c.o_inv
     AND status IN ('enviado','complemento_solicitado')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    INSERT INTO public.implementation_inventory_submissions (implementation_id, item_id, kind, proposed, previous, submitted_by, owner_id)
    VALUES (c.o_impl, p_item_id, 'item', v_prop, v_prev, c.o_inv, c.o_owner) RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.owner_inventory_image_paths_by_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM public.owner_inventory_token_ctx(p_token);
  RETURN coalesce((SELECT jsonb_object_agg(g.id, g.image_path) FROM public.implementation_guide_items g
    WHERE g.implementation_id = c.o_impl AND g.guide_type = 'inventario' AND g.enabled AND g.image_path IS NOT NULL), '{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.owner_inventory_resolve_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_inventory_submit_by_token(text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_inventory_image_paths_by_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_inventory_resolve_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_inventory_submit_by_token(text, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_inventory_image_paths_by_token(text) TO service_role;