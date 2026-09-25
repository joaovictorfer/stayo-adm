-- STAYO ADMIN — Fase 2D.2
-- Contrato público mínimo para apresentação de proposta publicada.
--
-- Princípios:
-- - proposal_share_links é o domínio do token de apresentação e permanece
--   separado de owner_portal_invitations (onboarding, que possui capacidades
--   sensíveis de cadastro/propriedade);
-- - links antigos são classificados como legacy e preservados;
-- - novos links são presentation por padrão e exigem expiração;
-- - o resolver público lê SOMENTE o snapshot imutável criado na publicação;
-- - nenhuma tabela interna recebe SELECT público;
-- - tokens presentation não podem usar o aceite legado.

DO $$
BEGIN
  IF to_regclass('public.proposal_share_links') IS NULL THEN
    RAISE EXCEPTION 'Fase 2D.2 interrompida: public.proposal_share_links não existe';
  END IF;
  IF to_regclass('public.proposals') IS NULL THEN
    RAISE EXCEPTION 'Fase 2D.2 interrompida: public.proposals não existe';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'proposals' AND column_name = 'status'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'proposals' AND column_name = 'snapshot'
  ) THEN
    RAISE EXCEPTION 'Fase 2D.2 interrompida: snapshot/status da Fase 2C não estão materializados';
  END IF;
  IF to_regprocedure('public.owner_onboarding_draft_resolve_v2(text)') IS NULL
     OR to_regprocedure('public.owner_property_details_resolve_by_token(text)') IS NULL
     OR to_regprocedure('public.proposal_accept_by_token(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Fase 2D.2 interrompida: RPCs públicas esperadas não existem';
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 1. Capacidade explícita do token de proposta
-- ---------------------------------------------------------------------

ALTER TABLE public.proposal_share_links
  ADD COLUMN IF NOT EXISTS link_type text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- Tudo que já existia antes desta migration mantém o comportamento legado.
UPDATE public.proposal_share_links
SET link_type = 'legacy'
WHERE link_type IS NULL;

-- Novos inserts sem tipo explícito nascem no modo mais restritivo. A constraint
-- abaixo obriga o emissor futuro a definir validade para presentation.
ALTER TABLE public.proposal_share_links
  ALTER COLUMN link_type SET DEFAULT 'presentation',
  ALTER COLUMN link_type SET NOT NULL;

ALTER TABLE public.proposal_share_links
  DROP CONSTRAINT IF EXISTS proposal_share_links_link_type_check;
ALTER TABLE public.proposal_share_links
  ADD CONSTRAINT proposal_share_links_link_type_check
  CHECK (link_type IN ('legacy', 'presentation'));

ALTER TABLE public.proposal_share_links
  DROP CONSTRAINT IF EXISTS proposal_share_links_presentation_expiry_check;
ALTER TABLE public.proposal_share_links
  ADD CONSTRAINT proposal_share_links_presentation_expiry_check
  CHECK (link_type <> 'presentation' OR expires_at IS NOT NULL);

-- ---------------------------------------------------------------------
-- 2. Resolver oficial de apresentação: whitelist do snapshot, nada vivo
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.proposal_public_resolve_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN
    RETURN NULL;
  END IF;

  SELECT p.snapshot
  INTO v_snapshot
  FROM public.proposal_share_links AS link
  JOIN public.proposals AS p
    ON p.id = link.proposal_id
   AND p.implementation_id = link.implementation_id
  WHERE link.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND link.revoked_at IS NULL
    AND (link.expires_at IS NULL OR link.expires_at >= now())
    AND p.status IN ('published', 'accepted', 'superseded')
    AND p.snapshot IS NOT NULL
    AND jsonb_typeof(p.snapshot) = 'object'
    AND p.snapshot->>'proposalId' = p.id::text
    AND p.snapshot->>'implementationId' = p.implementation_id::text
    AND p.snapshot->>'version' = p.version::text
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Whitelist deliberada. Não retornar `snapshot` inteiro evita que uma futura
  -- adição interna ao JSON seja automaticamente publicada sem revisão.
  RETURN jsonb_build_object(
    'schemaVersion', v_snapshot->'schemaVersion',
    'proposalId', v_snapshot->'proposalId',
    'implementationId', v_snapshot->'implementationId',
    'version', v_snapshot->'version',
    'opportunity', v_snapshot->'opportunity',
    'items', v_snapshot->'items',
    'total', v_snapshot->'total',
    'commercialTerms', v_snapshot->'commercialTerms',
    'contractConditions', v_snapshot->'contractConditions',
    'responsibilities', v_snapshot->'responsibilities',
    'content', v_snapshot->'content',
    'requiredSignatories', v_snapshot->'requiredSignatories',
    'publishedAt', v_snapshot->'publishedAt'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.proposal_public_resolve_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proposal_public_resolve_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.proposal_public_resolve_by_token(text) IS
  'Fase 2D.2: resolve exclusivamente a whitelist do snapshot publicado vinculado ao token de proposta.';

-- ---------------------------------------------------------------------
-- 3. Compatibilidade: resolver legado continua existindo, agora respeitando
--    revogação/expiração e nunca resolvendo draft/sem snapshot.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.proposal_resolve_by_token(p_token text)
RETURNS TABLE(
  proposal_id uuid,
  implementation_id uuid,
  version integer,
  items jsonb,
  total numeric,
  accepted_at timestamptz,
  accepted_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT
    p.id,
    p.implementation_id,
    p.version,
    p.snapshot->'items',
    NULLIF(p.snapshot->>'total', '')::numeric,
    p.accepted_at,
    p.accepted_name,
    p.created_at
  FROM public.proposal_share_links AS link
  JOIN public.proposals AS p
    ON p.id = link.proposal_id
   AND p.implementation_id = link.implementation_id
  WHERE link.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND link.revoked_at IS NULL
    AND (link.expires_at IS NULL OR link.expires_at >= now())
    AND p.status IN ('published', 'accepted', 'superseded')
    AND p.snapshot IS NOT NULL
    AND p.snapshot->>'proposalId' = p.id::text
    AND p.snapshot->>'implementationId' = p.implementation_id::text
    AND p.snapshot->>'version' = p.version::text
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.proposal_resolve_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proposal_resolve_by_token(text) TO anon, authenticated;

-- O aceite legado permanece somente para tokens classificados como legacy.
-- Um token presentation é estritamente read-only por capacidade.
CREATE OR REPLACE FUNCTION public.proposal_accept_by_token(p_token text, p_accepted_name text)
RETURNS TABLE(
  proposal_id uuid,
  implementation_id uuid,
  version integer,
  items jsonb,
  total numeric,
  accepted_at timestamptz,
  accepted_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_link public.proposal_share_links%rowtype;
  v_proposal public.proposals%rowtype;
BEGIN
  SELECT * INTO v_link
  FROM public.proposal_share_links
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND link_type = 'legacy'
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at >= now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposta não encontrada';
  END IF;

  UPDATE public.proposals AS pr
  SET accepted_at = now(), accepted_name = p_accepted_name, status = 'accepted'
  WHERE pr.id = v_link.proposal_id
    AND pr.status = 'published'
    AND pr.accepted_at IS NULL
  RETURNING pr.* INTO v_proposal;

  IF NOT FOUND THEN
    SELECT * INTO v_proposal
    FROM public.proposals AS pr
    WHERE pr.id = v_link.proposal_id
      AND pr.status IN ('accepted', 'superseded');
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposta não disponível para aceite';
  END IF;

  RETURN QUERY
    SELECT
      v_proposal.id,
      v_proposal.implementation_id,
      v_proposal.version,
      v_proposal.items,
      v_proposal.total,
      v_proposal.accepted_at,
      v_proposal.accepted_name,
      v_proposal.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.proposal_accept_by_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proposal_accept_by_token(text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. API direta: tabelas internas não são superfície pública
-- ---------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public.proposal_share_links FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.owner_portal_invitations FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.owner_onboarding_profiles FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.owner_onboarding_people FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.owner_payout_accounts FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.owner_onboarding_submissions FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.implementation_property_details FROM PUBLIC, anon;

-- `proposals` já foi fechada para anon na 0022; repetir é defesa em profundidade.
REVOKE ALL PRIVILEGES ON TABLE public.proposals FROM PUBLIC, anon;

-- SECURITY DEFINER continua sendo a única passagem pública autorizada. Remover
-- EXECUTE de PUBLIC evita herança acidental por roles futuras; anon/authenticated
-- mantêm somente as RPCs que já fazem parte do fluxo existente.
REVOKE ALL ON FUNCTION public.owner_onboarding_resolve_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_onboarding_submit(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_onboarding_draft_resolve(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_onboarding_draft_resolve_v2(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_onboarding_draft_save(text, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_onboarding_draft_save_v2(text, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_property_details_resolve_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_property_details_save_by_token(text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.owner_onboarding_resolve_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_submit(text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_resolve(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_resolve_v2(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_save(text, jsonb, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_save_v2(text, jsonb, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_property_details_resolve_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_property_details_save_by_token(text, jsonb) TO anon, authenticated;
