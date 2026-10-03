CREATE OR REPLACE FUNCTION public.admin_quick_mark_guide_item(p_item_id uuid, p_have boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_item public.implementation_guide_items%rowtype; v_resp uuid; v_qty integer;
BEGIN
  IF public.has_admin_role('super_admin','admin','commercial','operations') IS NOT TRUE THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_item FROM public.implementation_guide_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'item não encontrado'; END IF;
  v_qty := CASE WHEN p_have THEN v_item.recommended_quantity ELSE 0 END;
  INSERT INTO public.implementation_guide_responses (implementation_id, guide_item_id, answer, quantity, source, review_status)
  VALUES (v_item.implementation_id, v_item.id, CASE WHEN p_have THEN 'ja_tenho' ELSE 'nao_informado' END, v_qty, 'admin', 'pendente')
  ON CONFLICT (guide_item_id) DO UPDATE SET answer = EXCLUDED.answer, quantity = EXCLUDED.quantity, source = 'admin', review_status = 'pendente', updated_at = now()
  RETURNING id INTO v_resp;
  RETURN public.admin_review_guide_response(jsonb_build_object('responseId', v_resp, 'action', 'correct', 'quantity', v_qty, 'note', 'Marcação rápida STAYO'));
END; $$;
REVOKE ALL ON FUNCTION public.admin_quick_mark_guide_item(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_quick_mark_guide_item(uuid, boolean) TO authenticated;