ALTER TABLE public.implementation_projects
  ADD COLUMN IF NOT EXISTS cover_source text,
  ADD COLUMN IF NOT EXISTS cover_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS cover_approved_by uuid;
DO $$ BEGIN
  ALTER TABLE public.implementation_projects
    ADD CONSTRAINT implementation_projects_cover_source_chk
    CHECK (cover_source IS NULL OR cover_source IN ('implementation','condominium'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN public.implementation_projects.cover_source IS 'Capa do link do proprietário: implementation (cover_image próprio, caminho no bucket privado implementation-covers) ou condominium (usa a capa do condomínio vinculado). NULL = institucional.';

ALTER TABLE public.admin_condominiums
  ADD COLUMN IF NOT EXISTS cover_external_allowed boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.admin_condominiums.cover_external_allowed IS 'Equipe autorizou exibir cover_image do condomínio a proprietários.';

-- Resolve a capa efetiva de uma implantação segundo a prioridade:
-- capa aprovada da implantação -> foto principal do imóvel (Core: ainda não integrado)
-- -> capa autorizada do condomínio vinculado por FK -> institucional (NULL).
CREATE OR REPLACE FUNCTION public.implementation_effective_cover(p_implementation_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN ip.cover_source = 'implementation' AND ip.cover_approved_at IS NOT NULL
         AND ip.cover_image LIKE ('implementations/' || ip.id::text || '/%')
      THEN jsonb_build_object('path', ip.cover_image, 'source', 'implementation', 'label', NULL)
    WHEN ip.cover_source = 'condominium' AND c.id IS NOT NULL AND c.cover_external_allowed
         AND c.cover_image LIKE ('condominiums/' || c.id::text || '/%')
      THEN jsonb_build_object('path', c.cover_image, 'source', 'condominium', 'label', 'Condomínio ' || c.name)
    ELSE NULL
  END
  FROM public.implementation_projects ip
  LEFT JOIN public.admin_condominiums c ON c.id = ip.condominium_id
  WHERE ip.id = p_implementation_id;
$$;
REVOKE ALL ON FUNCTION public.implementation_effective_cover(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.implementation_effective_cover(uuid) TO service_role;

-- Capa para quem tem um link válido (apresentação, cadastro comercial ou implantação).
CREATE OR REPLACE FUNCTION public.owner_cover_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_hash text := encode(digest(coalesce(p_token,''), 'sha256'), 'hex'); v_id uuid;
BEGIN
  IF length(coalesce(p_token,'')) < 16 THEN RETURN NULL; END IF;
  SELECT implementation_id INTO v_id FROM public.owner_portal_invitations
   WHERE token_hash = v_hash AND revoked_at IS NULL AND expires_at > now() AND used_at IS NULL LIMIT 1;
  IF v_id IS NULL THEN
    SELECT implementation_id INTO v_id FROM public.owner_intake_links
     WHERE token_hash = v_hash AND revoked_at IS NULL AND expires_at > now() LIMIT 1;
  END IF;
  IF v_id IS NULL THEN
    SELECT implementation_id INTO v_id FROM public.proposal_share_links
     WHERE token_hash = v_hash AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) LIMIT 1;
  END IF;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.implementation_effective_cover(v_id);
END $$;
REVOKE ALL ON FUNCTION public.owner_cover_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_cover_by_token(text) TO anon, authenticated, service_role;

-- Capa para proprietário logado (só implantações próprias) ou equipe interna.
CREATE OR REPLACE FUNCTION public.owner_cover_for_implementation(p_implementation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.owner_can_access_implementation(p_implementation_id)
          OR public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer')) THEN
    RETURN NULL;
  END IF;
  RETURN public.implementation_effective_cover(p_implementation_id);
END $$;
REVOKE ALL ON FUNCTION public.owner_cover_for_implementation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_cover_for_implementation(uuid) TO authenticated, service_role;