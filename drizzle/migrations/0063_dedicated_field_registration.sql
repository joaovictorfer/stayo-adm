CREATE TABLE public.implementation_field_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text NOT NULL UNIQUE, implementation_id uuid REFERENCES public.implementation_projects(id), created_by uuid NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days', revoked_at timestamptz, revision integer NOT NULL DEFAULT 0, step integer NOT NULL DEFAULT 0, owns_contact boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,UPDATE ON public.implementation_field_links TO authenticated;
GRANT ALL ON public.implementation_field_links TO service_role;
ALTER TABLE public.implementation_field_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY field_links_admin ON public.implementation_field_links FOR ALL TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations') IS TRUE) WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations') IS TRUE);
CREATE OR REPLACE FUNCTION public.admin_create_field_link(p_hash text,p_implementation_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_id uuid; BEGIN
IF public.has_admin_role('super_admin','admin','commercial','operations') IS NOT TRUE THEN RAISE EXCEPTION 'sem permissão'; END IF;
IF p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'token inválido'; END IF;
IF p_implementation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.implementation_projects WHERE id=p_implementation_id AND status NOT IN ('ativo','cancelado') AND core_property_id IS NULL) THEN RAISE EXCEPTION 'ficha indisponível'; END IF;
INSERT INTO public.implementation_field_links(token_hash,implementation_id,created_by) VALUES(p_hash,p_implementation_id,auth.uid()) RETURNING id INTO v_id;
IF p_implementation_id IS NOT NULL THEN INSERT INTO public.implementation_survey_links(implementation_id,token_hash,created_by) VALUES(p_implementation_id,p_hash,auth.uid()); END IF;
RETURN v_id; END $$;
REVOKE ALL ON FUNCTION public.admin_create_field_link(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_create_field_link(text,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.field_registration_resolve(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.implementation_field_links; p public.implementation_projects; d public.implementation_property_details; o public.owner_records; a jsonb; BEGIN
SELECT * INTO l FROM public.implementation_field_links WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND revoked_at IS NULL AND expires_at>now();
IF l.id IS NULL THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;
SELECT * INTO p FROM public.implementation_projects WHERE id=l.implementation_id;
IF p.status IN ('ativo','cancelado') OR p.core_property_id IS NOT NULL THEN RAISE EXCEPTION 'Cadastro encerrado'; END IF;
SELECT * INTO d FROM public.implementation_property_details WHERE implementation_id=l.implementation_id;
SELECT * INTO o FROM public.owner_records WHERE id=p.owner_id;
SELECT data INTO a FROM public.implementation_amenities WHERE implementation_id=l.implementation_id;
RETURN jsonb_build_object('implementationId',l.implementation_id,'revision',l.revision,'step',l.step,'contactLocked',l.implementation_id IS NOT NULL AND NOT l.owns_contact AND p.owner_id IS NOT NULL,'condominiumLocked',p.condominium_id IS NOT NULL,'values',jsonb_build_object('name',coalesce(o.name,''),'phone',coalesce(o.phone,''),'condominium',coalesce(p.condominium_name,''),'unit',coalesce(p.unit,''),'box',coalesce(d.parking_box,''),'wifiNetwork',coalesce(d.wifi_network,''),'wifiPassword',coalesce(d.wifi_password,''),'bedrooms',p.bedrooms,'bathrooms',d.bathrooms,'lavatories',d.lavatories,'rooms',coalesce(a->'rooms','[]'::jsonb)));
END $$;
REVOKE ALL ON FUNCTION public.field_registration_resolve(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.field_registration_resolve(text) TO service_role;
CREATE OR REPLACE FUNCTION public.field_registration_save(p_token text,p_revision integer,p_patch jsonb,p_step integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.implementation_field_links; p public.implementation_projects; k text; v_owner uuid; v_code integer; v_name text; v_phone text; r jsonb; BEGIN
SELECT * INTO l FROM public.implementation_field_links WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
IF l.id IS NULL THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;
IF l.revision<>p_revision THEN RAISE EXCEPTION 'Cadastro alterado em outra sessão. Recarregue antes de continuar.'; END IF;
IF jsonb_typeof(p_patch)<>'object' OR octet_length(p_patch::text)>100000 OR p_step NOT BETWEEN 0 AND 3 THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
IF k NOT IN ('name','phone','condominium','unit','box','wifiNetwork','wifiPassword','bedrooms','bathrooms','lavatories','rooms') THEN RAISE EXCEPTION 'Campo não permitido'; END IF;
IF k IN ('name','phone','condominium','unit','box','wifiNetwork','wifiPassword') AND (jsonb_typeof(p_patch->k)<>'string' OR length(p_patch->>k)>200) THEN RAISE EXCEPTION 'Texto inválido'; END IF;
IF k IN ('bedrooms','bathrooms','lavatories') AND p_patch->k<>'null'::jsonb AND ((p_patch->>k)::numeric NOT BETWEEN 0 AND 20 OR (p_patch->>k)::numeric<>trunc((p_patch->>k)::numeric)) THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
END LOOP;
IF l.implementation_id IS NULL THEN
v_name:=btrim(p_patch->>'name'); v_phone:=regexp_replace(p_patch->>'phone','\D','','g');
IF length(coalesce(v_name,''))<2 OR v_phone !~ '^55[0-9]{10,11}$' OR v_phone IS NULL THEN RAISE EXCEPTION 'Preencha nome e telefone válidos'; END IF;
INSERT INTO public.owner_records(name,phone) VALUES(v_name,v_phone) RETURNING id INTO v_owner;
PERFORM pg_advisory_xact_lock(hashtext('implementation_code_sequence'));
SELECT coalesce(max((regexp_match(code,'^IMP-([0-9]+)$'))[1]::integer),0)+1 INTO v_code FROM public.implementation_projects;
INSERT INTO public.implementation_projects(code,status,owner_id,nickname,origin,responsible_user_id) VALUES('IMP-'||lpad(v_code::text,5,'0'),'prospect',v_owner,'Cadastro de '||v_name,'admin_draft:'||l.id::text,l.created_by) RETURNING * INTO p;
UPDATE public.implementation_field_links SET implementation_id=p.id,owns_contact=true WHERE id=l.id;
l.implementation_id:=p.id; l.owns_contact:=true;
INSERT INTO public.implementation_survey_links(implementation_id,token_hash,created_by,expires_at) VALUES(p.id,l.token_hash,l.created_by,l.expires_at);
ELSE SELECT * INTO p FROM public.implementation_projects WHERE id=l.implementation_id FOR UPDATE; END IF;
IF p.status IN ('ativo','cancelado') OR p.core_property_id IS NOT NULL THEN RAISE EXCEPTION 'Cadastro encerrado'; END IF;
IF (p_patch ? 'name' OR p_patch ? 'phone') THEN
IF NOT l.owns_contact AND p.owner_id IS NOT NULL THEN RAISE EXCEPTION 'Contato existente protegido'; END IF;
IF p_patch ? 'name' AND length(btrim(p_patch->>'name'))<2 THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
IF p_patch ? 'phone' AND p_patch->>'phone' !~ '^55[0-9]{10,11}$' THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
IF p.owner_id IS NULL THEN
IF length(coalesce(p_patch->>'name',''))<2 OR coalesce(p_patch->>'phone','') !~ '^55[0-9]{10,11}$' THEN RAISE EXCEPTION 'Nome e telefone obrigatórios'; END IF;
INSERT INTO public.owner_records(name,phone) VALUES(btrim(p_patch->>'name'),p_patch->>'phone') RETURNING id INTO v_owner;
UPDATE public.implementation_projects SET owner_id=v_owner WHERE id=p.id;
UPDATE public.implementation_field_links SET owns_contact=true WHERE id=l.id;
ELSE UPDATE public.owner_records SET name=CASE WHEN p_patch ? 'name' THEN btrim(p_patch->>'name') ELSE name END,phone=CASE WHEN p_patch ? 'phone' THEN p_patch->>'phone' ELSE phone END WHERE id=p.owner_id; END IF;
END IF;
IF p.condominium_id IS NOT NULL AND p_patch ? 'condominium' AND p_patch->>'condominium' IS DISTINCT FROM p.condominium_name THEN RAISE EXCEPTION 'Empreendimento vinculado: solicite ajuste à STAYO'; END IF;
UPDATE public.implementation_projects SET condominium_name=CASE WHEN p_patch ? 'condominium' THEN nullif(btrim(p_patch->>'condominium'),'') ELSE condominium_name END,unit=CASE WHEN p_patch ? 'unit' THEN nullif(btrim(p_patch->>'unit'),'') ELSE unit END,bedrooms=CASE WHEN p_patch ? 'bedrooms' THEN (p_patch->>'bedrooms')::integer ELSE bedrooms END WHERE id=p.id;
INSERT INTO public.implementation_property_details(implementation_id) VALUES(p.id) ON CONFLICT DO NOTHING;
UPDATE public.implementation_property_details SET parking_box=CASE WHEN p_patch ? 'box' THEN nullif(p_patch->>'box','') ELSE parking_box END,wifi_network=CASE WHEN p_patch ? 'wifiNetwork' THEN nullif(p_patch->>'wifiNetwork','') ELSE wifi_network END,wifi_password=CASE WHEN p_patch ? 'wifiPassword' THEN nullif(p_patch->>'wifiPassword','') ELSE wifi_password END,bathrooms=CASE WHEN p_patch ? 'bathrooms' THEN (p_patch->>'bathrooms')::integer ELSE bathrooms END,lavatories=CASE WHEN p_patch ? 'lavatories' THEN (p_patch->>'lavatories')::integer ELSE lavatories END WHERE implementation_id=p.id;
IF p_patch ? 'rooms' THEN
IF jsonb_typeof(p_patch->'rooms')<>'array' OR jsonb_array_length(p_patch->'rooms')>65 THEN RAISE EXCEPTION 'Ambientes inválidos'; END IF;
FOR r IN SELECT value FROM jsonb_array_elements(p_patch->'rooms') LOOP IF r->>'kind' NOT IN ('cozinha','sala','quarto','banheiro','lavabo','servico','externa','geral','outro') OR length(r->>'id')>80 THEN RAISE EXCEPTION 'Ambiente inválido'; END IF; END LOOP;
INSERT INTO public.implementation_amenities(implementation_id,data) VALUES(p.id,jsonb_build_object('rooms',p_patch->'rooms')) ON CONFLICT(implementation_id) DO UPDATE SET data=jsonb_set(implementation_amenities.data,'{rooms}',excluded.data->'rooms');
END IF;
UPDATE public.implementation_field_links SET revision=revision+1,step=p_step WHERE id=l.id;
INSERT INTO public.audit_logs(actor_id,event,entity_type,entity_id,metadata) VALUES(NULL,'field.registration.saved','implementation',p.id,jsonb_build_object('linkId',l.id,'fields',(SELECT jsonb_agg(key) FROM jsonb_object_keys(p_patch) key)));
RETURN public.field_registration_resolve(p_token);
END $$;
REVOKE ALL ON FUNCTION public.field_registration_save(text,integer,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.field_registration_save(text,integer,jsonb,integer) TO service_role;