-- ===== Cadastro comercial do proprietário (link próprio, só escrita em área de revisão) =====
CREATE TABLE IF NOT EXISTS public.owner_intake_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_access_at timestamptz
);
CREATE INDEX IF NOT EXISTS owner_intake_links_impl_idx ON public.owner_intake_links(implementation_id);
GRANT SELECT, INSERT, UPDATE ON public.owner_intake_links TO authenticated;
GRANT ALL ON public.owner_intake_links TO service_role;
ALTER TABLE public.owner_intake_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe lê links de cadastro comercial" ON public.owner_intake_links FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "equipe cria links de cadastro comercial" ON public.owner_intake_links FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));
CREATE POLICY "equipe revoga links de cadastro comercial" ON public.owner_intake_links FOR UPDATE TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));

CREATE TABLE IF NOT EXISTS public.owner_intake_submissions (
  implementation_id uuid PRIMARY KEY REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.owner_intake_links(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','correction_requested','discarded')),
  current_step integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  reviewed_by_name text,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_intake_submissions TO authenticated;
GRANT ALL ON public.owner_intake_submissions TO service_role;
ALTER TABLE public.owner_intake_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe lê cadastros recebidos" ON public.owner_intake_submissions FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));

-- Separação de domínio entre os três tipos de token público
CREATE OR REPLACE FUNCTION public.enforce_public_token_domain_separation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
BEGIN
  IF NEW.token_hash IS NULL OR char_length(NEW.token_hash) <> 64 THEN
    RAISE EXCEPTION 'hash de token público inválido';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('stayo_public_token:' || NEW.token_hash));
  IF TG_TABLE_NAME NOT IN ('proposal_share_links','owner_portal_invitations','owner_intake_links') THEN
    RAISE EXCEPTION 'domínio de token público inválido';
  END IF;
  IF TG_TABLE_NAME <> 'proposal_share_links' AND EXISTS (SELECT 1 FROM public.proposal_share_links WHERE token_hash = NEW.token_hash) THEN
    RAISE EXCEPTION 'token já pertence à proposta pública';
  END IF;
  IF TG_TABLE_NAME <> 'owner_portal_invitations' AND EXISTS (SELECT 1 FROM public.owner_portal_invitations WHERE token_hash = NEW.token_hash) THEN
    RAISE EXCEPTION 'token já pertence ao onboarding';
  END IF;
  IF TG_TABLE_NAME <> 'owner_intake_links' AND EXISTS (SELECT 1 FROM public.owner_intake_links WHERE token_hash = NEW.token_hash) THEN
    RAISE EXCEPTION 'token já pertence ao cadastro comercial';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS owner_intake_links_token_domain ON public.owner_intake_links;
CREATE TRIGGER owner_intake_links_token_domain BEFORE INSERT OR UPDATE OF token_hash ON public.owner_intake_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_public_token_domain_separation();

-- Estado do link
CREATE OR REPLACE FUNCTION public.owner_intake_link_by_token(p_token text)
 RETURNS public.owner_intake_links LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','extensions'
AS $$
  SELECT * FROM public.owner_intake_links
  WHERE token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex') LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.owner_intake_link_by_token(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_intake_resolve(p_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_link public.owner_intake_links;
  v_sub public.owner_intake_submissions;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN RETURN jsonb_build_object('state','invalid'); END IF;
  v_link := public.owner_intake_link_by_token(p_token);
  IF v_link.id IS NULL THEN RETURN jsonb_build_object('state','invalid'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('state','revoked'); END IF;
  IF v_link.expires_at < now() THEN RETURN jsonb_build_object('state','expired'); END IF;
  UPDATE public.owner_intake_links SET last_access_at = now() WHERE id = v_link.id;
  SELECT * INTO v_sub FROM public.owner_intake_submissions WHERE implementation_id = v_link.implementation_id;
  RETURN jsonb_build_object(
    'state','active',
    'status', coalesce(v_sub.status,'draft'),
    'currentStep', coalesce(v_sub.current_step,1),
    'data', coalesce(v_sub.data,'{}'::jsonb),
    'submittedAt', v_sub.submitted_at,
    'correctionNote', CASE WHEN v_sub.status = 'correction_requested' THEN v_sub.review_note END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_intake_resolve(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_intake_save(p_token text, p_data jsonb, p_step integer, p_submit boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_link public.owner_intake_links;
  v_status text;
  v_clean jsonb := '{}'::jsonb;
  v_key text;
  v_val text;
  v_num integer;
  v_digits text;
BEGIN
  v_link := public.owner_intake_link_by_token(p_token);
  IF v_link.id IS NULL OR v_link.revoked_at IS NOT NULL OR v_link.expires_at < now() THEN
    RAISE EXCEPTION 'link indisponível' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_status FROM public.owner_intake_submissions WHERE implementation_id = v_link.implementation_id FOR UPDATE;
  IF v_status IN ('submitted','approved','discarded') THEN
    RAISE EXCEPTION 'cadastro já enviado' USING ERRCODE = 'P0001';
  END IF;

  -- whitelist de texto
  FOREACH v_key IN ARRAY ARRAY['fullName','phone','email','city','district','postalCode','locationName','unitLabel','propertyType','notes'] LOOP
    v_val := nullif(btrim(coalesce(p_data->>v_key,'')),'');
    IF v_val IS NOT NULL THEN
      v_clean := v_clean || jsonb_build_object(v_key, left(v_val, CASE WHEN v_key = 'notes' THEN 1000 ELSE 160 END));
    END IF;
  END LOOP;
  -- whitelist numérica
  FOREACH v_key IN ARRAY ARRAY['bedrooms','bathrooms','capacity'] LOOP
    v_val := p_data->>v_key;
    IF v_val ~ '^\d{1,2}$' THEN
      v_num := v_val::integer;
      IF v_num BETWEEN 0 AND 50 THEN v_clean := v_clean || jsonb_build_object(v_key, v_num); END IF;
    END IF;
  END LOOP;

  IF p_submit THEN
    v_digits := regexp_replace(coalesce(v_clean->>'phone',''), '\D', '', 'g');
    IF length(coalesce(v_clean->>'fullName','')) < 3 THEN RAISE EXCEPTION 'Informe seu nome completo.' USING ERRCODE = 'P0001'; END IF;
    IF length(v_digits) NOT BETWEEN 10 AND 13 THEN RAISE EXCEPTION 'Informe um telefone com DDD.' USING ERRCODE = 'P0001'; END IF;
    IF v_clean->>'email' IS NOT NULL AND v_clean->>'email' !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = 'P0001'; END IF;
    IF v_clean->>'city' IS NULL THEN RAISE EXCEPTION 'Informe a cidade do imóvel.' USING ERRCODE = 'P0001'; END IF;
    IF v_clean->>'propertyType' IS NULL THEN RAISE EXCEPTION 'Informe o tipo do imóvel.' USING ERRCODE = 'P0001'; END IF;
  END IF;

  INSERT INTO public.owner_intake_submissions AS s (implementation_id, link_id, status, current_step, data, submitted_at, updated_at)
  VALUES (v_link.implementation_id, v_link.id,
          CASE WHEN p_submit THEN 'submitted' ELSE 'draft' END,
          greatest(1, least(4, coalesce(p_step,1))), v_clean,
          CASE WHEN p_submit THEN now() END, now())
  ON CONFLICT (implementation_id) DO UPDATE SET
    link_id = excluded.link_id,
    status = CASE WHEN p_submit THEN 'submitted' ELSE s.status END,
    current_step = excluded.current_step,
    data = excluded.data,
    submitted_at = CASE WHEN p_submit THEN now() ELSE s.submitted_at END,
    updated_at = now();

  IF p_submit THEN
    INSERT INTO public.implementation_timeline_updates (implementation_id, title, description, event_date, kind, owner_visible)
    VALUES (v_link.implementation_id, 'Cadastro recebido do proprietário', 'Aguardando revisão da equipe.', now(), 'cadastro', false);
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN p_submit THEN 'submitted' ELSE coalesce(v_status,'draft') END, 'savedAt', now());
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_intake_save(text, jsonb, integer, boolean) TO anon, authenticated;

-- Revisão pela equipe (decisão distinta da liberação de visualização)
CREATE OR REPLACE FUNCTION public.admin_review_owner_intake(p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_impl uuid := (p_data->>'implementationId')::uuid;
  v_decision text := p_data->>'decision';
  v_note text := nullif(btrim(coalesce(p_data->>'note','')),'');
  v_sub public.owner_intake_submissions;
  v_d jsonb;
  v_owner uuid;
  v_name text;
BEGIN
  IF NOT public.has_admin_role('super_admin','admin','commercial','operations') THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  IF v_decision NOT IN ('approve','request_correction','keep_pending') THEN
    RAISE EXCEPTION 'decisão inválida';
  END IF;
  SELECT * INTO v_sub FROM public.owner_intake_submissions WHERE implementation_id = v_impl FOR UPDATE;
  IF v_sub.implementation_id IS NULL OR v_sub.status <> 'submitted' THEN
    RAISE EXCEPTION 'não há cadastro pendente de revisão';
  END IF;
  IF v_decision = 'request_correction' AND v_note IS NULL THEN
    RAISE EXCEPTION 'Explique o que precisa ser corrigido.';
  END IF;
  SELECT full_name INTO v_name FROM public.admin_profiles WHERE id = auth.uid();
  v_d := v_sub.data;

  IF v_decision = 'approve' THEN
    UPDATE public.implementation_projects SET
      property_type = coalesce(v_d->>'propertyType', property_type),
      bedrooms = coalesce((v_d->>'bedrooms')::int, bedrooms),
      capacity = coalesce((v_d->>'capacity')::int, capacity),
      city = coalesce(v_d->>'city', city),
      postal_code = coalesce(v_d->>'postalCode', postal_code),
      condominium_name = coalesce(condominium_name, v_d->>'locationName'),
      unit = coalesce(unit, v_d->>'unitLabel'),
      updated_at = now()
    WHERE id = v_impl RETURNING owner_id INTO v_owner;

    INSERT INTO public.implementation_property_details (implementation_id, property_type, bedrooms, bathrooms, city, district, postal_code, updated_at)
    VALUES (v_impl, v_d->>'propertyType', (v_d->>'bedrooms')::int, (v_d->>'bathrooms')::int, v_d->>'city', v_d->>'district', v_d->>'postalCode', now())
    ON CONFLICT (implementation_id) DO UPDATE SET
      property_type = coalesce(excluded.property_type, implementation_property_details.property_type),
      bedrooms = coalesce(excluded.bedrooms, implementation_property_details.bedrooms),
      bathrooms = coalesce(excluded.bathrooms, implementation_property_details.bathrooms),
      city = coalesce(excluded.city, implementation_property_details.city),
      district = coalesce(excluded.district, implementation_property_details.district),
      postal_code = coalesce(excluded.postal_code, implementation_property_details.postal_code),
      updated_at = now();

    -- Identidade oficial nunca é sobrescrita: só preenche o que está vazio.
    IF v_owner IS NULL AND v_d->>'fullName' IS NOT NULL THEN
      INSERT INTO public.owner_records (name, phone, email, lifecycle_status)
      VALUES (v_d->>'fullName', v_d->>'phone', v_d->>'email', 'prospect') RETURNING id INTO v_owner;
      UPDATE public.implementation_projects SET owner_id = v_owner WHERE id = v_impl;
    ELSIF v_owner IS NOT NULL THEN
      UPDATE public.owner_records SET
        phone = coalesce(phone, v_d->>'phone'),
        email = coalesce(email, v_d->>'email'),
        updated_at = now()
      WHERE id = v_owner;
    END IF;
  END IF;

  UPDATE public.owner_intake_submissions SET
    status = CASE v_decision WHEN 'approve' THEN 'approved' WHEN 'request_correction' THEN 'correction_requested' ELSE 'submitted' END,
    review_note = coalesce(v_note, review_note),
    reviewed_at = CASE WHEN v_decision = 'keep_pending' THEN reviewed_at ELSE now() END,
    reviewed_by = CASE WHEN v_decision = 'keep_pending' THEN reviewed_by ELSE auth.uid() END,
    reviewed_by_name = CASE WHEN v_decision = 'keep_pending' THEN reviewed_by_name ELSE v_name END,
    updated_at = now()
  WHERE implementation_id = v_impl;

  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'owner_intake.' || v_decision, 'implementation', v_impl, jsonb_build_object('note', v_note));

  RETURN jsonb_build_object('ok', true, 'decision', v_decision);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_review_owner_intake(jsonb) TO authenticated;

-- ===== Visibilidade no portal: só o que foi expressamente liberado =====
CREATE TABLE IF NOT EXISTS public.portal_visibility_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  block text NOT NULL CHECK (block IN ('overview','proposal','documents')),
  content jsonb NOT NULL,
  released_by uuid NOT NULL,
  released_by_name text,
  released_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_visibility_one_active ON public.portal_visibility_releases(implementation_id, block) WHERE revoked_at IS NULL;
GRANT SELECT ON public.portal_visibility_releases TO authenticated;
GRANT ALL ON public.portal_visibility_releases TO service_role;
ALTER TABLE public.portal_visibility_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe lê liberações" ON public.portal_visibility_releases FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "proprietário lê só liberações ativas dos próprios imóveis" ON public.portal_visibility_releases FOR SELECT TO authenticated
  USING (revoked_at IS NULL AND public.owner_can_access_implementation(implementation_id));

CREATE OR REPLACE FUNCTION public.admin_release_portal_block(p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_release_portal_block(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_hide_portal_block(p_implementation_id uuid, p_block text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_admin_role('super_admin','admin','commercial','operations') THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  UPDATE public.portal_visibility_releases SET revoked_at = now(), revoked_by = auth.uid()
  WHERE implementation_id = p_implementation_id AND block = p_block AND revoked_at IS NULL;
  INSERT INTO public.audit_logs (actor_id, event, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'portal.block_hidden', 'implementation', p_implementation_id, jsonb_build_object('block', p_block));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_hide_portal_block(uuid, text) TO authenticated;

-- Proprietário: documentos só quando enviados por ele ou expressamente liberados
CREATE OR REPLACE FUNCTION public.portal_attachment_released(p_attachment_id uuid, p_implementation_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_visibility_releases r
    WHERE r.implementation_id = p_implementation_id AND r.block = 'documents' AND r.revoked_at IS NULL
      AND r.content->'documents' @> jsonb_build_array(jsonb_build_object('attachmentId', p_attachment_id::text))
  );
$$;
GRANT EXECUTE ON FUNCTION public.portal_attachment_released(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "proprietário lê os próprios anexos" ON public.attachments;
CREATE POLICY "proprietário lê anexos próprios ou liberados" ON public.attachments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.owner_portal_accounts opa WHERE opa.id = auth.uid() AND opa.owner_id = attachments.owner_id)
    AND (attachments.uploaded_by = auth.uid()
         OR (attachments.implementation_id IS NOT NULL AND public.portal_attachment_released(attachments.id, attachments.implementation_id)))
  );