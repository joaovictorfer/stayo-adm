CREATE OR REPLACE FUNCTION public.owner_inventory_resolve(p_implementation_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
        'description', g.description,
        'purchaseUrl', CASE WHEN g.purchase_url ~* '^https?://' THEN g.purchase_url END,
        'hasImage', g.image_path IS NOT NULL,
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
END $function$;

CREATE OR REPLACE FUNCTION public.owner_inventory_image_paths(p_implementation_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.owner_can_access_implementation(p_implementation_id) THEN
    RAISE EXCEPTION 'sem acesso' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_object_agg(g.id, g.image_path)
    FROM public.implementation_guide_items g
    WHERE g.implementation_id = p_implementation_id AND g.guide_type = 'inventario'
      AND g.enabled AND g.image_path IS NOT NULL), '{}'::jsonb);
END $function$;
REVOKE ALL ON FUNCTION public.owner_inventory_image_paths(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_inventory_image_paths(uuid) TO authenticated, service_role;