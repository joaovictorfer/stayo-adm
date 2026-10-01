-- Inventário guiado: evolui o catálogo de guias (catálogo → snapshot na implantação)
-- com guide_type 'inventario' e o ambiente do item. Não toca Enxoval nem Core.
ALTER TABLE public.guide_catalog_items DROP CONSTRAINT guide_catalog_items_guide_type_check;
ALTER TABLE public.guide_catalog_items ADD CONSTRAINT guide_catalog_items_guide_type_check
  CHECK (guide_type IN ('utensilios','enxoval','inventario'));
ALTER TABLE public.implementation_guide_items DROP CONSTRAINT implementation_guide_items_guide_type_check;
ALTER TABLE public.implementation_guide_items ADD CONSTRAINT implementation_guide_items_guide_type_check
  CHECK (guide_type IN ('utensilios','enxoval','inventario'));

ALTER TABLE public.guide_catalog_items ADD COLUMN room text;
ALTER TABLE public.implementation_guide_items ADD COLUMN room text;

ALTER TABLE public.guide_catalog_items ADD CONSTRAINT guide_catalog_items_inventory_room_check
  CHECK (guide_type <> 'inventario' OR room IN ('cozinha','sala','quartos','banheiros','lavanderia','externa','outros'));
ALTER TABLE public.implementation_guide_items ADD CONSTRAINT implementation_guide_items_inventory_room_check
  CHECK (guide_type <> 'inventario' OR room IN ('cozinha','sala','quartos','banheiros','lavanderia','externa','outros'));

CREATE INDEX IF NOT EXISTS implementation_guide_items_impl_type_room_idx
  ON public.implementation_guide_items (implementation_id, guide_type, room, display_order);

CREATE OR REPLACE FUNCTION public.admin_apply_guide(p_implementation_id uuid, p_guide_type text DEFAULT 'utensilios'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  IF public.has_admin_role('super_admin','admin','commercial','operations') IS NOT TRUE THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  IF p_guide_type NOT IN ('utensilios','enxoval','inventario') THEN RAISE EXCEPTION 'tipo de guia inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.implementation_projects WHERE id = p_implementation_id) THEN
    RAISE EXCEPTION 'implantação não encontrada';
  END IF;
  INSERT INTO public.implementation_guide_items (implementation_id, guide_type, catalog_item_id, category, name,
    recommended_quantity, quantity_text, size_text, description, tip, purchase_url, image_path, classification, display_order, room)
  SELECT p_implementation_id, c.guide_type, c.id, c.category, c.name, c.recommended_quantity, c.quantity_text, c.size_text,
    c.description, c.tip, c.purchase_url, c.image_path, c.classification, c.display_order, c.room
  FROM public.guide_catalog_items c
  WHERE c.guide_type = p_guide_type AND c.active
  ON CONFLICT (implementation_id, catalog_item_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'guide.applied', 'implementation', p_implementation_id, jsonb_build_object('guideType', p_guide_type, 'added', v_count));
  RETURN v_count;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_apply_guide(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_guide(uuid, text) TO authenticated;