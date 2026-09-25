\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public.implementation_projects (id, code)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'IMP-2D2-DOMAIN');

INSERT INTO public.proposals (
  id, implementation_id, version, items, total, status, snapshot, published_at
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  1,
  '[]'::jsonb,
  10,
  'published',
  jsonb_build_object(
    'schemaVersion', 1,
    'proposalId', '30000000-0000-0000-0000-000000000001',
    'implementationId', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'version', 1,
    'opportunity', '{}'::jsonb,
    'items', '[]'::jsonb,
    'total', 10,
    'commercialTerms', '[]'::jsonb,
    'contractConditions', '{}'::jsonb,
    'responsibilities', '[]'::jsonb,
    'content', '[]'::jsonb,
    'requiredSignatories', '[]'::jsonb,
    'publishedAt', '2099-01-01T12:00:00Z'
  ),
  '2099-01-01T12:00:00Z'
);

-- Um hash já pertencente ao onboarding não pode virar token de proposta.
INSERT INTO public.owner_portal_invitations (
  implementation_id, token_hash, expires_at
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  encode(digest('domain-owner-00000000-0000-0000-0000-000000000001', 'sha256'), 'hex'),
  now() + interval '7 days'
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.proposal_share_links (
      proposal_id, implementation_id, token_hash, link_type, expires_at
    ) VALUES (
      '30000000-0000-0000-0000-000000000001',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      encode(digest('domain-owner-00000000-0000-0000-0000-000000000001', 'sha256'), 'hex'),
      'presentation',
      now() + interval '7 days'
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'token já pertence ao onboarding' THEN
      v_denied := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'onboarding token hash was accepted as presentation token';
  END IF;
END
$$;

-- O caminho inverso também é fechado: token de proposta não pode virar convite.
INSERT INTO public.proposal_share_links (
  proposal_id, implementation_id, token_hash, link_type, expires_at
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  encode(digest('domain-presentation-00000000-0000-0000-0000-00000002', 'sha256'), 'hex'),
  'presentation',
  now() + interval '7 days'
);

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.owner_portal_invitations (
      implementation_id, token_hash, expires_at
    ) VALUES (
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      encode(digest('domain-presentation-00000000-0000-0000-0000-00000002', 'sha256'), 'hex'),
      now() + interval '7 days'
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'token já pertence à proposta pública' THEN
      v_denied := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'presentation token hash was accepted as onboarding token';
  END IF;
END
$$;

-- Com a separação garantida no armazenamento, o token presentation continua
-- sem resolver qualquer uma das superfícies sensíveis de onboarding.
DO $$
BEGIN
  IF public.owner_onboarding_draft_resolve_v2(
    'domain-presentation-00000000-0000-0000-0000-00000002'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'presentation token reached onboarding PII after domain guard';
  END IF;

  IF public.owner_property_details_resolve_by_token(
    'domain-presentation-00000000-0000-0000-0000-00000002'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'presentation token reached property secrets after domain guard';
  END IF;
END
$$;

ROLLBACK;
