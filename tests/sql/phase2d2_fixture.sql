\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.admin_profiles (
  id uuid PRIMARY KEY
);

CREATE TABLE public.implementation_projects (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE
);

CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  version integer NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(12,2) NOT NULL DEFAULT 0,
  accepted_at timestamptz,
  accepted_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','accepted','superseded')),
  draft_revision integer NOT NULL DEFAULT 1,
  draft_responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_signatories jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES public.admin_profiles(id),
  publish_command_id uuid,
  last_draft_command_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.admin_profiles(id),
  UNIQUE (implementation_id, version)
);

CREATE TABLE public.proposal_share_links (
  proposal_id uuid PRIMARY KEY REFERENCES public.proposals(id) ON DELETE CASCADE,
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.owner_portal_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  last_access_at timestamptz,
  owner_id uuid,
  public_snapshot jsonb
);

CREATE TABLE public.owner_onboarding_profiles (
  implementation_id uuid PRIMARY KEY,
  tax_id text,
  legal_name text,
  email text
);

CREATE TABLE public.owner_onboarding_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL,
  document text,
  full_name text
);

CREATE TABLE public.owner_payout_accounts (
  implementation_id uuid PRIMARY KEY,
  bank_name text,
  account_number text,
  pix_key text
);

CREATE TABLE public.owner_onboarding_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL,
  full_name text,
  document text,
  email text,
  phone text,
  pix_key text,
  submitted_at timestamptz DEFAULT now()
);

CREATE TABLE public.implementation_property_details (
  implementation_id uuid PRIMARY KEY,
  street text,
  access_code text,
  wifi_network text,
  wifi_password text
);

CREATE TABLE public.commercial_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL,
  label text NOT NULL,
  value numeric NOT NULL
);

CREATE TABLE public.implementation_contract_conditions (
  implementation_id uuid PRIMARY KEY,
  administration_fee numeric
);

-- Simula o legado observado no Lovable Cloud: anon tem grants de tabela,
-- mas a superfície pública correta deve passar somente por RPCs.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_onboarding_resolve_token(p_token text)
RETURNS TABLE(implementation_id uuid, expires_at timestamptz, used_at timestamptz, revoked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT i.implementation_id, i.expires_at, i.used_at, i.revoked_at
  FROM public.owner_portal_invitations i
  WHERE i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.owner_onboarding_draft_resolve(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT jsonb_build_object('taxId', p.tax_id, 'bankName', a.bank_name)
  FROM public.owner_portal_invitations i
  LEFT JOIN public.owner_onboarding_profiles p USING (implementation_id)
  LEFT JOIN public.owner_payout_accounts a USING (implementation_id)
  WHERE i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND i.revoked_at IS NULL AND i.expires_at >= now()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.owner_onboarding_draft_resolve_v2(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT public.owner_onboarding_draft_resolve(p_token)
$$;

CREATE OR REPLACE FUNCTION public.owner_onboarding_draft_save(p_token text, p_data jsonb, p_submit boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT public.owner_onboarding_draft_resolve(p_token)
$$;

CREATE OR REPLACE FUNCTION public.owner_onboarding_draft_save_v2(p_token text, p_data jsonb, p_submit boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT public.owner_onboarding_draft_resolve_v2(p_token)
$$;

CREATE OR REPLACE FUNCTION public.owner_property_details_resolve_by_token(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT jsonb_build_object('propertyAccessCode', d.access_code, 'propertyWifiPassword', d.wifi_password)
  FROM public.owner_portal_invitations i
  LEFT JOIN public.implementation_property_details d USING (implementation_id)
  WHERE i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND i.revoked_at IS NULL AND i.expires_at >= now()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.owner_property_details_save_by_token(p_token text, p_data jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT public.owner_property_details_resolve_by_token(p_token)
$$;

CREATE OR REPLACE FUNCTION public.owner_onboarding_submit(
  p_token text, p_full_name text, p_document text, p_email text, p_phone text, p_pix_key text
)
RETURNS public.owner_onboarding_submissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_row public.owner_onboarding_submissions%rowtype;
BEGIN
  SELECT s.* INTO v_row
  FROM public.owner_portal_invitations i
  JOIN public.owner_onboarding_submissions s USING (implementation_id)
  WHERE i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  LIMIT 1;
  RETURN v_row;
END
$$;

CREATE OR REPLACE FUNCTION public.proposal_accept_by_token(p_token text, p_accepted_name text)
RETURNS TABLE(
  proposal_id uuid, implementation_id uuid, version integer, items jsonb,
  total numeric, accepted_at timestamptz, accepted_name text, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT p.id, p.implementation_id, p.version, p.items, p.total,
         p.accepted_at, p.accepted_name, p.created_at
  FROM public.proposal_share_links l
  JOIN public.proposals p ON p.id = l.proposal_id
  WHERE l.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.proposal_resolve_by_token(p_token text)
RETURNS TABLE(
  proposal_id uuid, implementation_id uuid, version integer, items jsonb,
  total numeric, accepted_at timestamptz, accepted_name text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT p.id, p.implementation_id, p.version, p.items, p.total,
         p.accepted_at, p.accepted_name, p.created_at
  FROM public.proposal_share_links l
  JOIN public.proposals p ON p.id = l.proposal_id
  WHERE l.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.owner_onboarding_resolve_token(text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_submit(text,text,text,text,text,text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_resolve(text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_resolve_v2(text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_save(text,jsonb,boolean) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_draft_save_v2(text,jsonb,boolean) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_property_details_resolve_by_token(text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_property_details_save_by_token(text,jsonb) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proposal_accept_by_token(text,text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proposal_resolve_by_token(text) TO PUBLIC, anon, authenticated;
