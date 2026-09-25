\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public.implementation_projects (id, code) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'IMP-2D2-A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'IMP-2D2-B');

INSERT INTO public.commercial_terms (implementation_id, label, value) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Taxa viva antes', 12.34);
INSERT INTO public.implementation_contract_conditions (implementation_id, administration_fee) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 10.00);

-- Snapshot publicado válido A.
INSERT INTO public.proposals (
  id, implementation_id, version, items, total, status, snapshot, published_at
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  1,
  '[{"description":"Gestão","quantity":1,"unitValue":100,"discount":0,"total":100}]'::jsonb,
  100,
  'published',
  jsonb_build_object(
    'schemaVersion', 1,
    'proposalId', '10000000-0000-0000-0000-000000000001',
    'implementationId', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'version', 1,
    'opportunity', jsonb_build_object('code','IMP-2D2-A','title','Oportunidade A'),
    'items', '[{"description":"Gestão","quantity":1,"unitValue":100,"discount":0,"total":100}]'::jsonb,
    'total', 100,
    'commercialTerms', '[{"label":"Taxa congelada","chargeType":"recurring","value":9.9,"optional":false,"displayOrder":1,"notes":null}]'::jsonb,
    'contractConditions', jsonb_build_object('administrationFee', 9.9),
    'responsibilities', '["Responsabilidade publicada"]'::jsonb,
    'content', '[{"title":"Como funciona","body":"Conteúdo publicado","displayOrder":1}]'::jsonb,
    'requiredSignatories', '[{"label":"Proprietário","role":"owner"}]'::jsonb,
    'publishedAt', '2099-01-01T12:00:00Z'
  ),
  '2099-01-01T12:00:00Z'
);

-- Casos negativos: expirado, revogado, draft, sem snapshot e cruzado.
INSERT INTO public.proposals (id, implementation_id, version, items, total, status, snapshot, published_at) VALUES
  ('10000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2,'[]',20,'published',jsonb_build_object('schemaVersion',1,'proposalId','10000000-0000-0000-0000-000000000002','implementationId','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','version',2,'opportunity','{}'::jsonb,'items','[]'::jsonb,'total',20,'commercialTerms','[]'::jsonb,'contractConditions','{}'::jsonb,'responsibilities','[]'::jsonb,'content','[]'::jsonb,'requiredSignatories','[]'::jsonb,'publishedAt','2099-01-01T12:00:00Z'),'2099-01-01T12:00:00Z'),
  ('10000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',3,'[]',30,'published',jsonb_build_object('schemaVersion',1,'proposalId','10000000-0000-0000-0000-000000000003','implementationId','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','version',3,'opportunity','{}'::jsonb,'items','[]'::jsonb,'total',30,'commercialTerms','[]'::jsonb,'contractConditions','{}'::jsonb,'responsibilities','[]'::jsonb,'content','[]'::jsonb,'requiredSignatories','[]'::jsonb,'publishedAt','2099-01-01T12:00:00Z'),'2099-01-01T12:00:00Z'),
  ('10000000-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',4,'[]',40,'draft',jsonb_build_object('schemaVersion',1,'proposalId','10000000-0000-0000-0000-000000000004','implementationId','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','version',4,'opportunity','{}'::jsonb,'items','[]'::jsonb,'total',40,'commercialTerms','[]'::jsonb,'contractConditions','{}'::jsonb,'responsibilities','[]'::jsonb,'content','[]'::jsonb,'requiredSignatories','[]'::jsonb,'publishedAt','2099-01-01T12:00:00Z'),null),
  ('10000000-0000-0000-0000-000000000005','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',5,'[]',50,'published',null,'2099-01-01T12:00:00Z'),
  ('20000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',1,'[]',60,'published',jsonb_build_object('schemaVersion',1,'proposalId','20000000-0000-0000-0000-000000000001','implementationId','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','version',1,'opportunity','{}'::jsonb,'items','[]'::jsonb,'total',60,'commercialTerms','[]'::jsonb,'contractConditions','{}'::jsonb,'responsibilities','[]'::jsonb,'content','[]'::jsonb,'requiredSignatories','[]'::jsonb,'publishedAt','2099-01-01T12:00:00Z'),'2099-01-01T12:00:00Z');

INSERT INTO public.proposal_share_links (
  proposal_id, implementation_id, token_hash, link_type, expires_at, revoked_at
) VALUES
  ('10000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',encode(digest('pres-valid-00000000-0000-0000-0000-000000000001','sha256'),'hex'),'presentation',now()+interval '7 days',null),
  ('10000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',encode(digest('pres-expired-00000000-0000-0000-0000-0000000002','sha256'),'hex'),'presentation',now()-interval '1 minute',null),
  ('10000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',encode(digest('pres-revoked-00000000-0000-0000-0000-0000000003','sha256'),'hex'),'presentation',now()+interval '7 days',now()),
  ('10000000-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',encode(digest('pres-draft-00000000-0000-0000-0000-000000000004','sha256'),'hex'),'presentation',now()+interval '7 days',null),
  ('10000000-0000-0000-0000-000000000005','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',encode(digest('pres-nosnap-00000000-0000-0000-0000-00000000005','sha256'),'hex'),'presentation',now()+interval '7 days',null),
  -- FK separadas permitem esta inconsistência histórica; o resolver precisa negar.
  ('20000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',encode(digest('pres-cross-00000000-0000-0000-0000-000000000006','sha256'),'hex'),'presentation',now()+interval '7 days',null);

DO $$
DECLARE
  v jsonb;
  v_count integer;
BEGIN
  v := public.proposal_public_resolve_by_token('pres-valid-00000000-0000-0000-0000-000000000001');
  IF v IS NULL THEN RAISE EXCEPTION 'valid presentation token did not resolve'; END IF;
  IF v->>'proposalId' <> '10000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'resolver returned the wrong proposal';
  END IF;
  IF v->'commercialTerms'->0->>'label' <> 'Taxa congelada' THEN
    RAISE EXCEPTION 'resolver did not use the published snapshot';
  END IF;

  SELECT count(*) INTO v_count FROM jsonb_object_keys(v);
  IF v_count <> 13 THEN
    RAISE EXCEPTION 'public whitelist changed unexpectedly: % keys', v_count;
  END IF;

  IF v ?| ARRAY[
    'acceptedAt','acceptedName','draftRevision','draftResponsibilities','publishedBy',
    'updatedBy','taxId','document','bankName','accountNumber','pixKey',
    'propertyAccessCode','propertyWifiPassword'
  ] THEN
    RAISE EXCEPTION 'public resolver exposed a forbidden key';
  END IF;

  IF public.proposal_public_resolve_by_token('invalid-token-00000000-0000-0000-0000-0000000000') IS NOT NULL THEN
    RAISE EXCEPTION 'invalid token should not resolve';
  END IF;
  IF public.proposal_public_resolve_by_token('pres-expired-00000000-0000-0000-0000-0000000002') IS NOT NULL THEN
    RAISE EXCEPTION 'expired token should not resolve';
  END IF;
  IF public.proposal_public_resolve_by_token('pres-revoked-00000000-0000-0000-0000-0000000003') IS NOT NULL THEN
    RAISE EXCEPTION 'revoked token should not resolve';
  END IF;
  IF public.proposal_public_resolve_by_token('pres-draft-00000000-0000-0000-0000-000000000004') IS NOT NULL THEN
    RAISE EXCEPTION 'draft should not resolve';
  END IF;
  IF public.proposal_public_resolve_by_token('pres-nosnap-00000000-0000-0000-0000-00000000005') IS NOT NULL THEN
    RAISE EXCEPTION 'proposal without snapshot should not resolve';
  END IF;
  IF public.proposal_public_resolve_by_token('pres-cross-00000000-0000-0000-0000-000000000006') IS NOT NULL THEN
    RAISE EXCEPTION 'cross-implementation link should not resolve';
  END IF;
END
$$;

-- Novo presentation sem validade deve falhar fechado.
INSERT INTO public.proposals (id, implementation_id, version, items, total, status, snapshot, published_at)
VALUES (
  '10000000-0000-0000-0000-000000000006','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',6,'[]',70,'published',
  jsonb_build_object('schemaVersion',1,'proposalId','10000000-0000-0000-0000-000000000006','implementationId','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','version',6,'opportunity','{}'::jsonb,'items','[]'::jsonb,'total',70,'commercialTerms','[]'::jsonb,'contractConditions','{}'::jsonb,'responsibilities','[]'::jsonb,'content','[]'::jsonb,'requiredSignatories','[]'::jsonb,'publishedAt','2099-01-01T12:00:00Z'),
  '2099-01-01T12:00:00Z'
);
DO $$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.proposal_share_links (proposal_id, implementation_id, token_hash, link_type)
    VALUES (
      '10000000-0000-0000-0000-000000000006',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      encode(digest('pres-no-expiry-00000000-0000-0000-0000-000000007','sha256'),'hex'),
      'presentation'
    );
  EXCEPTION WHEN check_violation THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'presentation link without expiry should be denied'; END IF;
END
$$;

-- Presentation token não pertence ao domínio de onboarding e não pode ler PII,
-- banco, endereço/código de acesso/Wi-Fi nem usar o aceite legado.
DO $$
DECLARE
  v_denied boolean := false;
  v_accept_before timestamptz;
  v_accept_after timestamptz;
BEGIN
  IF public.owner_onboarding_draft_resolve_v2('pres-valid-00000000-0000-0000-0000-000000000001') IS NOT NULL THEN
    RAISE EXCEPTION 'presentation token reached onboarding PII';
  END IF;
  IF public.owner_property_details_resolve_by_token('pres-valid-00000000-0000-0000-0000-000000000001') IS NOT NULL THEN
    RAISE EXCEPTION 'presentation token reached property secrets';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.owner_onboarding_resolve_token('pres-valid-00000000-0000-0000-0000-000000000001')
  ) THEN
    RAISE EXCEPTION 'presentation token resolved as onboarding invitation';
  END IF;

  SELECT accepted_at INTO v_accept_before
  FROM public.proposals WHERE id='10000000-0000-0000-0000-000000000001';

  BEGIN
    PERFORM public.proposal_accept_by_token(
      'pres-valid-00000000-0000-0000-0000-000000000001',
      'Pessoa Teste'
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'proposta não encontrada' THEN v_denied := true; ELSE RAISE; END IF;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'presentation token should not accept proposal'; END IF;

  SELECT accepted_at INTO v_accept_after
  FROM public.proposals WHERE id='10000000-0000-0000-0000-000000000001';
  IF v_accept_after IS DISTINCT FROM v_accept_before THEN
    RAISE EXCEPTION 'presentation token changed proposal acceptance state';
  END IF;
END
$$;

-- Alterações em dados vivos não podem alterar a apresentação congelada.
DO $$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  v_before := public.proposal_public_resolve_by_token('pres-valid-00000000-0000-0000-0000-000000000001');

  UPDATE public.commercial_terms
  SET label='Taxa viva depois', value=99.99
  WHERE implementation_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  UPDATE public.implementation_contract_conditions
  SET administration_fee=77.77
  WHERE implementation_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  v_after := public.proposal_public_resolve_by_token('pres-valid-00000000-0000-0000-0000-000000000001');
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'public response changed after live commercial data changed';
  END IF;
END
$$;

-- A API automática das tabelas internas deve estar realmente fechada para anon,
-- não apenas filtrada por RLS.
SET ROLE anon;
DO $$
DECLARE
  v_table text;
  v_denied boolean;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'proposals',
    'proposal_share_links',
    'owner_portal_invitations',
    'owner_onboarding_profiles',
    'owner_onboarding_people',
    'owner_payout_accounts',
    'owner_onboarding_submissions',
    'implementation_property_details'
  ] LOOP
    v_denied := false;
    BEGIN
      EXECUTE format('select 1 from public.%I limit 1', v_table);
    EXCEPTION WHEN insufficient_privilege THEN
      v_denied := true;
    END;
    IF NOT v_denied THEN
      RAISE EXCEPTION 'anon direct SELECT should be denied on %', v_table;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE v jsonb;
BEGIN
  v := public.proposal_public_resolve_by_token('pres-valid-00000000-0000-0000-0000-000000000001');
  IF v IS NULL THEN RAISE EXCEPTION 'anon lost allowed resolver access'; END IF;
END
$$;
RESET ROLE;

-- EXECUTE não fica herdado por PUBLIC; somente os papéis explicitamente
-- autorizados mantêm a superfície pública necessária.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE specific_schema='public'
      AND routine_name IN (
        'proposal_public_resolve_by_token','proposal_resolve_by_token','proposal_accept_by_token',
        'owner_onboarding_resolve_token','owner_onboarding_submit',
        'owner_onboarding_draft_resolve','owner_onboarding_draft_resolve_v2',
        'owner_onboarding_draft_save','owner_onboarding_draft_save_v2',
        'owner_property_details_resolve_by_token','owner_property_details_save_by_token'
      )
      AND grantee='PUBLIC'
  ) THEN
    RAISE EXCEPTION 'PUBLIC still has EXECUTE on a token RPC';
  END IF;
END
$$;

ROLLBACK;
