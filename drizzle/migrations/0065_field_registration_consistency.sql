CREATE OR REPLACE FUNCTION public.field_project_revision_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
UPDATE public.implementation_field_links SET revision=NEW.revision WHERE implementation_id=NEW.implementation_id AND id<>NEW.id AND revision<>NEW.revision;
RETURN NEW; END $$;
CREATE TRIGGER field_project_revision_sync AFTER UPDATE OF revision ON public.implementation_field_links FOR EACH ROW WHEN (pg_trigger_depth()=0) EXECUTE FUNCTION public.field_project_revision_sync();
CREATE OR REPLACE FUNCTION public.survey_link_ctx(p_token text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT s.implementation_id FROM public.implementation_survey_links s WHERE s.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND s.revoked_at IS NULL AND s.expires_at>now()
AND NOT EXISTS(SELECT 1 FROM public.implementation_field_links f LEFT JOIN public.implementation_projects p ON p.id=f.implementation_id WHERE f.token_hash=s.token_hash AND (f.revoked_at IS NOT NULL OR f.expires_at<=now() OR p.id IS NULL OR p.status IN ('ativo','cancelado') OR p.core_property_id IS NOT NULL)) LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.field_registration_save_guarded(p_token text,p_revision integer,p_patch jsonb,p_step integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
PERFORM 1 FROM public.implementation_projects WHERE id=(SELECT implementation_id FROM public.implementation_field_links WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) FOR UPDATE;
RETURN public.field_registration_save(p_token,p_revision,p_patch,p_step);
END $$;
REVOKE ALL ON FUNCTION public.field_registration_save_guarded(text,integer,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.field_registration_save_guarded(text,integer,jsonb,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.field_registration_enter_inventory(p_token text,p_revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.implementation_field_links; BEGIN
SELECT * INTO l FROM public.implementation_field_links WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND revoked_at IS NULL AND expires_at>now();
IF l.id IS NULL OR l.implementation_id IS NULL THEN RAISE EXCEPTION 'Link inválido'; END IF;
PERFORM 1 FROM public.implementation_projects WHERE id=l.implementation_id FOR UPDATE;
SELECT * INTO l FROM public.implementation_field_links WHERE id=l.id FOR UPDATE;
IF l.revision<>p_revision THEN RAISE EXCEPTION 'Cadastro alterado em outra sessão'; END IF;
PERFORM public.field_registration_prepare_inventory(p_token);
RETURN public.field_registration_save(p_token,p_revision,'{}'::jsonb,3);
END $$;
REVOKE ALL ON FUNCTION public.field_registration_enter_inventory(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.field_registration_enter_inventory(text,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.field_registration_prepare_inventory(p_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.implementation_field_links; p public.implementation_projects; d public.implementation_property_details; r jsonb; c public.guide_catalog_items; i integer; v_category text; v_qty integer; v_notes text;
BEGIN
SELECT * INTO l FROM public.implementation_field_links WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
IF l.id IS NULL OR l.implementation_id IS NULL THEN RAISE EXCEPTION 'Cadastro obrigatório'; END IF;
SELECT * INTO p FROM public.implementation_projects WHERE id=l.implementation_id FOR UPDATE;
SELECT * INTO d FROM public.implementation_property_details WHERE implementation_id=p.id;
IF p.status IN ('ativo','cancelado') OR p.core_property_id IS NOT NULL THEN RAISE EXCEPTION 'Cadastro encerrado'; END IF;
IF p.owner_id IS NULL OR nullif(p.condominium_name,'') IS NULL OR nullif(p.unit,'') IS NULL OR p.bedrooms IS NULL OR d.bathrooms IS NULL OR d.lavatories IS NULL THEN RAISE EXCEPTION 'Preencha os dados do imóvel e os ambientes'; END IF;
FOR c IN SELECT * FROM public.guide_catalog_items WHERE guide_type='inventario' AND active LOOP
FOR i IN 1..CASE WHEN c.room='quartos' THEN p.bedrooms WHEN c.room='banheiros' THEN d.bathrooms+d.lavatories ELSE 1 END LOOP
v_category:=CASE WHEN c.room='quartos' THEN 'Quarto '||i WHEN c.room='banheiros' AND i<=d.bathrooms THEN 'Banheiro '||i WHEN c.room='banheiros' THEN 'Lavabo '||(i-d.bathrooms) ELSE c.category END;
IF NOT EXISTS(SELECT 1 FROM public.implementation_guide_items WHERE implementation_id=p.id AND guide_type='inventario' AND name=c.name AND room=c.room AND (category=v_category OR (i=1 AND catalog_item_id=c.id))) THEN
INSERT INTO public.implementation_guide_items(implementation_id,guide_type,catalog_item_id,base_catalog_item_id,category,name,recommended_quantity,quantity_text,size_text,description,tip,purchase_url,image_path,classification,display_order,room)
VALUES(p.id,'inventario',CASE WHEN i=1 THEN c.id END,c.id,v_category,c.name,c.recommended_quantity,c.quantity_text,c.size_text,c.description,c.tip,c.purchase_url,c.image_path,c.classification,c.display_order,c.room) ON CONFLICT(implementation_id,catalog_item_id) DO NOTHING;
END IF;
END LOOP;
END LOOP;
FOR r IN SELECT value FROM public.implementation_amenities a,jsonb_array_elements(a.data->'rooms') WHERE a.implementation_id=p.id AND value->>'kind'='quarto' LOOP
SELECT coalesce(sum(value::integer),0),string_agg(key||' '||value,', ') INTO v_qty,v_notes FROM jsonb_each_text(coalesce(r#>'{items,camas,opts}','{}'::jsonb)) WHERE value::integer>0;
IF v_qty>0 THEN
INSERT INTO public.implementation_guide_items(implementation_id,guide_type,amenity_key,room,category,name,inventory_answer,inventory_quantity,inventory_internal_notes,inventory_answered_at)
VALUES(p.id,'inventario','r:'||(r->>'id')||':camas','quartos',regexp_replace(r->>'name','^Quarto 0','Quarto '),(r->>'name')||' · Camas','tenho',v_qty,v_notes,now())
ON CONFLICT(implementation_id,amenity_key) DO UPDATE SET inventory_quantity=excluded.inventory_quantity,inventory_internal_notes=excluded.inventory_internal_notes,inventory_answer='tenho',enabled=true;
ELSE
UPDATE public.implementation_guide_items SET enabled=false WHERE implementation_id=p.id AND amenity_key='r:'||(r->>'id')||':camas';
END IF;
END LOOP;
UPDATE public.implementation_guide_items SET enabled=false WHERE implementation_id=p.id AND amenity_key LIKE 'r:%:camas' AND NOT EXISTS(SELECT 1 FROM public.implementation_amenities a,jsonb_array_elements(a.data->'rooms') room WHERE a.implementation_id=p.id AND amenity_key='r:'||(room->>'id')||':camas');
END $$;