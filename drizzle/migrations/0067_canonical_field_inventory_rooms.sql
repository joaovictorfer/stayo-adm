ALTER TABLE public.implementation_guide_items ADD COLUMN inventory_room_key text;
COMMENT ON COLUMN public.implementation_guide_items.inventory_room_key IS 'Canonical amenities room id; private bathrooms use <bedroom id>:bath. Null preserves legacy grouping.';
CREATE INDEX implementation_inventory_room_key_idx ON public.implementation_guide_items(implementation_id,inventory_room_key) WHERE inventory_room_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.field_registration_prepare_inventory(p_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.implementation_field_links; p public.implementation_projects; d public.implementation_property_details; r jsonb; c public.guide_catalog_items; t record; v_rooms jsonb; v_id uuid; v_used uuid[] := '{}'; v_qty integer; v_notes text;
BEGIN
SELECT * INTO l FROM public.implementation_field_links WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
IF l.id IS NULL OR l.implementation_id IS NULL THEN RAISE EXCEPTION 'Cadastro obrigatório'; END IF;
SELECT * INTO p FROM public.implementation_projects WHERE id=l.implementation_id FOR UPDATE;
SELECT * INTO d FROM public.implementation_property_details WHERE implementation_id=p.id;
IF p.status IN ('ativo','cancelado') OR p.core_property_id IS NOT NULL THEN RAISE EXCEPTION 'Cadastro encerrado'; END IF;
IF p.owner_id IS NULL OR nullif(p.condominium_name,'') IS NULL OR nullif(p.unit,'') IS NULL OR p.bedrooms IS NULL OR d.bathrooms IS NULL OR d.lavatories IS NULL THEN RAISE EXCEPTION 'Preencha os dados do imóvel e os ambientes'; END IF;
SELECT data->'rooms' INTO v_rooms FROM public.implementation_amenities WHERE implementation_id=p.id;
IF jsonb_typeof(v_rooms) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ambientes obrigatórios'; END IF;
FOR c IN SELECT * FROM public.guide_catalog_items WHERE guide_type='inventario' AND active ORDER BY display_order,id LOOP
FOR t IN
 WITH rooms AS (SELECT value r, ord FROM jsonb_array_elements(v_rooms) WITH ORDINALITY e(value,ord)),
 bedrooms AS (SELECT r,ord,row_number() OVER(ORDER BY ord) n FROM rooms WHERE r->>'kind'='quarto'),
 baths AS (SELECT r->>'id' k,r->>'name' label,ord FROM rooms WHERE r->>'kind'='banheiro'
 UNION ALL SELECT (r->>'id')||':bath','Banheiro '||(r->>'name'),1000+ord FROM bedrooms WHERE r->>'suite'='true'),
 targets AS (
 SELECT r->>'id' k,r->>'name' label,'Quarto '||n legacy,'quartos' room FROM bedrooms
 UNION ALL SELECT k,label,'Banheiro '||row_number() OVER(ORDER BY ord),'banheiros' FROM baths
 UNION ALL SELECT r->>'id',r->>'name','Lavabo '||row_number() OVER(ORDER BY ord),'banheiros' FROM rooms WHERE r->>'kind'='lavabo'
 UNION ALL SELECT NULL,c.category,c.category,c.room WHERE c.room NOT IN ('quartos','banheiros'))
 SELECT * FROM targets WHERE room=c.room
LOOP
v_id := NULL;
SELECT g.id INTO v_id FROM public.implementation_guide_items g
 WHERE g.implementation_id=p.id AND g.guide_type='inventario' AND g.name=c.name AND g.room=c.room
 AND (g.catalog_item_id=c.id OR g.base_catalog_item_id=c.id) AND NOT(g.id=ANY(v_used))
 AND ((t.k IS NOT NULL AND g.inventory_room_key=t.k) OR (g.inventory_room_key IS NULL AND
 (g.category=t.legacy OR g.category=t.label OR (g.catalog_item_id=c.id AND NOT EXISTS(SELECT 1 FROM public.implementation_guide_items z WHERE z.implementation_id=p.id AND z.name=c.name AND z.room=c.room AND z.category=t.legacy)))))
 ORDER BY (g.inventory_room_key=t.k) DESC NULLS LAST,(g.category=t.legacy) DESC,g.created_at,g.id LIMIT 1;
IF v_id IS NULL THEN
 INSERT INTO public.implementation_guide_items(implementation_id,guide_type,catalog_item_id,base_catalog_item_id,inventory_room_key,category,name,recommended_quantity,quantity_text,size_text,description,tip,purchase_url,image_path,classification,display_order,room)
 VALUES(p.id,'inventario',CASE WHEN NOT EXISTS(SELECT 1 FROM public.implementation_guide_items WHERE implementation_id=p.id AND catalog_item_id=c.id) THEN c.id END,c.id,t.k,t.label,c.name,c.recommended_quantity,c.quantity_text,c.size_text,c.description,c.tip,c.purchase_url,c.image_path,c.classification,c.display_order,c.room)
 RETURNING id INTO v_id;
ELSE
 UPDATE public.implementation_guide_items SET inventory_room_key=t.k,category=t.label WHERE id=v_id AND (inventory_room_key IS DISTINCT FROM t.k OR category IS DISTINCT FROM t.label);
END IF;
v_used := array_append(v_used,v_id);
END LOOP;
END LOOP;
UPDATE public.implementation_guide_items g SET enabled=false WHERE g.implementation_id=p.id AND g.guide_type='inventario' AND g.room IN ('quartos','banheiros') AND g.amenity_key IS NULL AND NOT(g.id=ANY(v_used))
 AND EXISTS(SELECT 1 FROM public.guide_catalog_items c WHERE c.guide_type='inventario' AND c.name=g.name AND (c.id=g.catalog_item_id OR c.id=g.base_catalog_item_id))
 AND g.inventory_answer IS NULL AND g.inventory_quantity IS NULL AND g.inventory_brand IS NULL AND g.inventory_condition IS NULL AND g.inventory_internal_notes IS NULL AND g.inventory_answered_at IS NULL AND coalesce(g.inventory_subanswers,'{}'::jsonb)='{}'::jsonb
 AND NOT EXISTS(SELECT 1 FROM public.implementation_survey_photos ph WHERE ph.guide_item_id=g.id)
 AND NOT EXISTS(SELECT 1 FROM public.implementation_inventory_submissions s WHERE s.item_id=g.id)
 AND NOT EXISTS(SELECT 1 FROM public.implementation_guide_responses s WHERE s.guide_item_id=g.id);
FOR r IN SELECT value FROM jsonb_array_elements(v_rooms) WHERE value->>'kind'='quarto' LOOP
SELECT coalesce(sum(value::integer),0),string_agg(key||' '||value,', ') INTO v_qty,v_notes FROM jsonb_each_text(coalesce(r#>'{items,camas,opts}','{}'::jsonb)) WHERE value::integer>0;
IF v_qty>0 THEN
INSERT INTO public.implementation_guide_items(implementation_id,guide_type,amenity_key,inventory_room_key,room,category,name,inventory_answer,inventory_quantity,inventory_internal_notes,inventory_answered_at)
VALUES(p.id,'inventario','r:'||(r->>'id')||':camas',r->>'id','quartos',r->>'name',(r->>'name')||' · Camas','tenho',v_qty,v_notes,now())
ON CONFLICT(implementation_id,amenity_key) DO UPDATE SET inventory_room_key=excluded.inventory_room_key,category=excluded.category,name=excluded.name,enabled=true;
ELSE UPDATE public.implementation_guide_items SET enabled=false WHERE implementation_id=p.id AND amenity_key='r:'||(r->>'id')||':camas'; END IF;
END LOOP;
UPDATE public.implementation_guide_items SET enabled=false WHERE implementation_id=p.id AND amenity_key LIKE 'r:%:camas' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_rooms) room WHERE amenity_key='r:'||(room->>'id')||':camas');
END $$;
REVOKE ALL ON FUNCTION public.field_registration_prepare_inventory(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.field_registration_prepare_inventory(text) TO service_role;
DO $migration$ DECLARE def text; BEGIN
SELECT pg_get_functiondef('public.survey_resolve(text)'::regprocedure) INTO def;
def := replace(def, '''category'',category,''name'',name', '''category'',category,''roomKey'',inventory_room_key,''name'',name');
EXECUTE def;
END $migration$;