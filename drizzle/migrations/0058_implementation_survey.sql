ALTER TABLE public.implementation_guide_items DROP CONSTRAINT implementation_guide_items_inventory_condition_check;
ALTER TABLE public.implementation_guide_items ADD CONSTRAINT implementation_guide_items_inventory_condition_check
  CHECK (inventory_condition IS NULL OR inventory_condition IN ('novo','bom','desgaste','trocar','atencao','danificado'));

CREATE TABLE public.implementation_survey_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.implementation_survey_links TO authenticated;
GRANT ALL ON public.implementation_survey_links TO service_role;
ALTER TABLE public.implementation_survey_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage survey links" ON public.implementation_survey_links FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));

CREATE TABLE public.implementation_survey_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  guide_item_id uuid NOT NULL REFERENCES public.implementation_guide_items(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.implementation_survey_photos TO authenticated;
GRANT ALL ON public.implementation_survey_photos TO service_role;
ALTER TABLE public.implementation_survey_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read survey photos" ON public.implementation_survey_photos FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));

CREATE TABLE public.inventory_brand_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inventory_brand_options_name_key ON public.inventory_brand_options (lower(name));
GRANT SELECT, INSERT ON public.inventory_brand_options TO authenticated;
GRANT ALL ON public.inventory_brand_options TO service_role;
ALTER TABLE public.inventory_brand_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read brands" ON public.inventory_brand_options FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));

CREATE TABLE public.inventory_note_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inventory_note_presets_text_key ON public.inventory_note_presets (lower(text));
GRANT SELECT, INSERT ON public.inventory_note_presets TO authenticated;
GRANT ALL ON public.inventory_note_presets TO service_role;
ALTER TABLE public.inventory_note_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read notes" ON public.inventory_note_presets FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));

INSERT INTO public.inventory_brand_options(name) VALUES ('Havan'),('Tramontina'),('Electrolux'),('Brastemp'),('Consul'),('Oxford'),('Mondial'),('Philco'),('Samsung'),('LG'),('Tok&Stok'),('Camicado'),('Nadir'),('Arno');
INSERT INTO public.inventory_note_presets(text) VALUES ('Item com marcas de uso'),('Precisa de limpeza'),('Peça faltando'),('Lascado ou trincado'),('Não funciona'),('Quantidade insuficiente'),('Substituir antes da operação'),('Item do proprietário — não usar');

CREATE OR REPLACE FUNCTION public.survey_link_ctx(p_token text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT implementation_id FROM public.implementation_survey_links
  WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex')
    AND revoked_at IS NULL AND expires_at > now() LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.survey_link_ctx(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.survey_link_ctx(text) TO service_role;

CREATE OR REPLACE FUNCTION public.survey_resolve(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_impl uuid := public.survey_link_ctx(p_token);
BEGIN
  IF v_impl IS NULL THEN RAISE EXCEPTION 'link inválido ou expirado'; END IF;
  RETURN jsonb_build_object(
    'implementation', (SELECT jsonb_build_object('id', id, 'name', coalesce(nullif(nickname,''), condominium_name, 'Imóvel')) FROM public.implementation_projects WHERE id = v_impl),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'room',room,'category',category,'name',name,'tip',tip,
        'answer',inventory_answer,'quantity',inventory_quantity,'brand',inventory_brand,'condition',inventory_condition,'notes',inventory_internal_notes)
        ORDER BY room, display_order) FROM public.implementation_guide_items
        WHERE implementation_id = v_impl AND guide_type='inventario' AND enabled), '[]'::jsonb),
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'itemId',guide_item_id,'path',storage_path) ORDER BY created_at)
        FROM public.implementation_survey_photos WHERE implementation_id = v_impl), '[]'::jsonb),
    'brands', coalesce((SELECT jsonb_agg(name ORDER BY lower(name)) FROM public.inventory_brand_options), '[]'::jsonb),
    'notes', coalesce((SELECT jsonb_agg(text ORDER BY created_at) FROM public.inventory_note_presets), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.survey_save_item(p_token text, p_item_id uuid, p_answer text, p_quantity integer, p_brand text, p_condition text, p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_impl uuid := public.survey_link_ctx(p_token); v_brand text := nullif(trim(p_brand),'');
BEGIN
  IF v_impl IS NULL THEN RAISE EXCEPTION 'link inválido ou expirado'; END IF;
  IF p_answer IS NOT NULL AND p_answer NOT IN ('tenho','nao_tenho','nao_aplica') THEN RAISE EXCEPTION 'resposta inválida'; END IF;
  IF char_length(coalesce(v_brand,'')) > 80 OR char_length(coalesce(p_notes,'')) > 2000 OR coalesce(p_quantity,0) NOT BETWEEN 0 AND 999 THEN RAISE EXCEPTION 'valor fora do limite'; END IF;
  UPDATE public.implementation_guide_items SET
    inventory_answer = p_answer, inventory_answered_at = CASE WHEN p_answer IS NULL THEN NULL ELSE now() END,
    inventory_quantity = p_quantity, inventory_brand = v_brand, inventory_condition = nullif(p_condition,''),
    inventory_internal_notes = nullif(trim(p_notes),''), inventory_source = 'equipe', inventory_updated_at = now()
  WHERE id = p_item_id AND implementation_id = v_impl AND guide_type = 'inventario';
  IF NOT FOUND THEN RAISE EXCEPTION 'item não encontrado'; END IF;
  IF v_brand IS NOT NULL AND lower(v_brand) NOT IN ('n/a','não identificada','nao identificada') THEN
    INSERT INTO public.inventory_brand_options(name) VALUES (v_brand) ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.survey_add_note_preset(p_token text, p_text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := nullif(trim(p_text),'');
BEGIN
  IF public.survey_link_ctx(p_token) IS NULL THEN RAISE EXCEPTION 'link inválido ou expirado'; END IF;
  IF v IS NULL OR char_length(v) > 140 THEN RAISE EXCEPTION 'observação inválida'; END IF;
  INSERT INTO public.inventory_note_presets(text) VALUES (v) ON CONFLICT DO NOTHING;
END $$;

GRANT EXECUTE ON FUNCTION public.survey_resolve(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.survey_save_item(text, uuid, text, integer, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.survey_add_note_preset(text, text) TO anon, authenticated;