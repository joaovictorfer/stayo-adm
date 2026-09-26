CREATE TABLE public.supplier_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialties text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','approved','archived')),
  phone text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX supplier_catalog_name_uq ON public.supplier_catalog (lower(btrim(name)));
GRANT SELECT, INSERT, UPDATE ON public.supplier_catalog TO authenticated;
GRANT ALL ON public.supplier_catalog TO service_role;
ALTER TABLE public.supplier_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read catalog" ON public.supplier_catalog FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "admins write catalog" ON public.supplier_catalog FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE POLICY "admins update catalog" ON public.supplier_catalog FOR UPDATE TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE TRIGGER supplier_catalog_updated BEFORE UPDATE ON public.supplier_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.supplier_catalog (name, specialties, status, notes) VALUES
  ('ON Instaladora', ARRAY['ar_condicionado','eletrica','hidraulica'], 'suggested', NULL),
  ('Broilo Aquecimento', ARRAY['aquecimento'], 'suggested', 'Gás só quando o serviço for confirmado para o imóvel.'),
  ('Casa VIP Móveis', ARRAY['moveis'], 'suggested', NULL),
  ('Fluir Hidráulica', ARRAY['hidraulica'], 'suggested', NULL),
  ('LH Instalações', ARRAY['eletrica'], 'suggested', NULL);

CREATE TABLE public.property_supplier_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (implementation_id, key)
);
GRANT SELECT, INSERT, DELETE ON public.property_supplier_categories TO authenticated;
GRANT ALL ON public.property_supplier_categories TO service_role;
ALTER TABLE public.property_supplier_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read categories" ON public.property_supplier_categories FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "admins add categories" ON public.property_supplier_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE POLICY "admins delete categories" ON public.property_supplier_categories FOR DELETE TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'));

CREATE TABLE public.property_supplier_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  category_key text NOT NULL,
  answer text NOT NULL CHECK (answer IN ('catalog','other','unknown','not_applicable')),
  catalog_id uuid REFERENCES public.supplier_catalog(id),
  other_name text,
  role text CHECK (role IS NULL OR role IN ('forneceu','instalou','forneceu_instalou','atende')),
  phone text,
  service text,
  approx_date text,
  notes text,
  admin_notes text,
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('owner','admin')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (answer <> 'catalog' OR catalog_id IS NOT NULL)
);
CREATE INDEX property_supplier_entries_impl ON public.property_supplier_entries (implementation_id);
GRANT SELECT, INSERT, UPDATE ON public.property_supplier_entries TO authenticated;
GRANT ALL ON public.property_supplier_entries TO service_role;
ALTER TABLE public.property_supplier_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read entries" ON public.property_supplier_entries FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "admins add entries" ON public.property_supplier_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE POLICY "admins update entries" ON public.property_supplier_entries FOR UPDATE TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE TRIGGER property_supplier_entries_updated BEFORE UPDATE ON public.property_supplier_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Histórico imutável: toda versão anterior de cada resposta.
CREATE TABLE public.property_supplier_entry_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.property_supplier_entries(id) ON DELETE CASCADE,
  implementation_id uuid NOT NULL,
  data jsonb NOT NULL,
  source text NOT NULL,
  actor_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_supplier_entry_history TO authenticated;
GRANT ALL ON public.property_supplier_entry_history TO service_role;
ALTER TABLE public.property_supplier_entry_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read supplier history" ON public.property_supplier_entry_history FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));

CREATE OR REPLACE FUNCTION public.property_supplier_entries_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(NEW) - 'updated_at') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.property_supplier_entry_history (entry_id, implementation_id, data, source, actor_id)
  VALUES (NEW.id, NEW.implementation_id, to_jsonb(NEW) - 'admin_notes', NEW.source, auth.uid());
  RETURN NEW;
END $$;
CREATE TRIGGER property_supplier_entries_hist AFTER INSERT OR UPDATE ON public.property_supplier_entries
  FOR EACH ROW EXECUTE FUNCTION public.property_supplier_entries_history();

-- Resolve o convite de implantação (mesma validação do cadastro do proprietário).
CREATE OR REPLACE FUNCTION public.owner_suppliers_invitation(p_token text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_id uuid;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN RETURN NULL; END IF;
  SELECT implementation_id INTO v_id FROM public.owner_portal_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') AND revoked_at IS NULL AND expires_at >= now()
  LIMIT 1;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.owner_suppliers_invitation(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_suppliers_resolve(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := public.owner_suppliers_invitation(p_token);
BEGIN
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'categories', coalesce((SELECT jsonb_agg(jsonb_build_object('key', key, 'label', label) ORDER BY created_at)
      FROM public.property_supplier_categories WHERE implementation_id = v_id), '[]'::jsonb),
    'catalog', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'specialties', specialties) ORDER BY name)
      FROM public.supplier_catalog WHERE status = 'approved'), '[]'::jsonb),
    'entries', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'categoryKey', e.category_key, 'answer', e.answer, 'catalogId', e.catalog_id,
        'catalogName', c.name, 'otherName', e.other_name, 'role', e.role, 'phone', e.phone,
        'service', e.service, 'approxDate', e.approx_date, 'notes', e.notes, 'source', e.source,
        'locked', e.source = 'admin') ORDER BY e.created_at)
      FROM public.property_supplier_entries e LEFT JOIN public.supplier_catalog c ON c.id = e.catalog_id
      WHERE e.implementation_id = v_id AND e.deleted_at IS NULL), '[]'::jsonb)
  );
END $$;

-- Salva as respostas do proprietário. Nunca altera respostas revisadas pela STAYO.
CREATE OR REPLACE FUNCTION public.owner_suppliers_save(p_token text, p_entries jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid := public.owner_suppliers_invitation(p_token);
  v_e jsonb;
  v_entry_id uuid;
  v_answer text;
  v_catalog uuid;
  v_keep uuid[] := '{}';
  v_existing public.property_supplier_entries%rowtype;
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'link inválido ou expirado'; END IF;
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) > 80 THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  FOR v_e IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_entry_id := (v_e->>'id')::uuid;
    v_answer := v_e->>'answer';
    IF v_answer NOT IN ('catalog','other','unknown','not_applicable') THEN RAISE EXCEPTION 'resposta inválida'; END IF;
    v_catalog := NULL;
    IF v_answer = 'catalog' THEN
      SELECT id INTO v_catalog FROM public.supplier_catalog WHERE id = (v_e->>'catalogId')::uuid AND status = 'approved';
      IF v_catalog IS NULL THEN RAISE EXCEPTION 'empresa indisponível'; END IF;
    END IF;
    IF char_length(coalesce(v_e->>'categoryKey','')) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'categoria inválida'; END IF;
    v_keep := v_keep || v_entry_id;
    SELECT * INTO v_existing FROM public.property_supplier_entries WHERE id = v_entry_id;
    IF FOUND THEN
      IF v_existing.implementation_id <> v_id THEN RAISE EXCEPTION 'dados inválidos'; END IF;
      IF v_existing.source = 'admin' THEN CONTINUE; END IF;
      UPDATE public.property_supplier_entries SET
        category_key = v_e->>'categoryKey', answer = v_answer, catalog_id = v_catalog,
        other_name = CASE WHEN v_answer = 'other' THEN nullif(btrim(left(v_e->>'otherName', 160)), '') END,
        role = nullif(v_e->>'role',''), phone = nullif(btrim(left(v_e->>'phone', 40)), ''),
        service = nullif(btrim(left(v_e->>'service', 300)), ''), approx_date = nullif(btrim(left(v_e->>'approxDate', 40)), ''),
        notes = nullif(btrim(left(v_e->>'notes', 1000)), ''), deleted_at = NULL
      WHERE id = v_entry_id;
    ELSE
      INSERT INTO public.property_supplier_entries (id, implementation_id, category_key, answer, catalog_id, other_name,
        role, phone, service, approx_date, notes, source)
      VALUES (v_entry_id, v_id, v_e->>'categoryKey', v_answer, v_catalog,
        CASE WHEN v_answer = 'other' THEN nullif(btrim(left(v_e->>'otherName', 160)), '') END,
        nullif(v_e->>'role',''), nullif(btrim(left(v_e->>'phone', 40)), ''), nullif(btrim(left(v_e->>'service', 300)), ''),
        nullif(btrim(left(v_e->>'approxDate', 40)), ''), nullif(btrim(left(v_e->>'notes', 1000)), ''), 'owner');
    END IF;
  END LOOP;
  -- Removidas pelo proprietário: marcadas, nunca apagadas (histórico preservado).
  UPDATE public.property_supplier_entries SET deleted_at = now()
  WHERE implementation_id = v_id AND source = 'owner' AND deleted_at IS NULL AND NOT (id = ANY(v_keep));
  RETURN public.owner_suppliers_resolve(p_token);
END $$;
REVOKE ALL ON FUNCTION public.owner_suppliers_resolve(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_suppliers_save(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_suppliers_resolve(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_suppliers_save(text, jsonb) TO anon, authenticated;