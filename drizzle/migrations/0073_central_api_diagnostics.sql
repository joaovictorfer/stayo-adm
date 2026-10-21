CREATE TABLE public.stayo_central_diagnostics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource text NOT NULL CHECK(resource IN ('connection','properties','owners','reservations','checkin')),
 queried_at timestamptz NOT NULL DEFAULT now(), succeeded boolean NOT NULL, result_kind text NOT NULL CHECK(result_kind IN ('ok','not_configured','invalid_origin','unauthorized','forbidden','rate_limited','unavailable','timeout','network','invalid_response','pagination','contract_pending')),
 http_status integer, request_id text, returned_count integer NOT NULL DEFAULT 0 CHECK(returned_count>=0), actor_id uuid NOT NULL,
 CHECK(request_id IS NULL OR request_id ~ '^[a-zA-Z0-9_-]{1,200}$')
);
GRANT SELECT,INSERT ON public.stayo_central_diagnostics TO authenticated;
GRANT ALL ON public.stayo_central_diagnostics TO service_role;
ALTER TABLE public.stayo_central_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY central_diagnostic_read ON public.stayo_central_diagnostics FOR SELECT TO authenticated USING(public.has_admin_role('super_admin','admin'));
CREATE POLICY central_diagnostic_insert ON public.stayo_central_diagnostics FOR INSERT TO authenticated WITH CHECK(public.has_admin_role('super_admin','admin') AND actor_id=auth.uid());
CREATE INDEX central_diagnostic_recent ON public.stayo_central_diagnostics(queried_at DESC);
CREATE TABLE public.stayo_central_checkpoints (
 resource text PRIMARY KEY CHECK(resource IN ('properties','owners','reservations')),
 completed_round_started_at timestamptz, last_full_scan_at timestamptz, filters jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.stayo_central_checkpoints TO authenticated;
GRANT ALL ON public.stayo_central_checkpoints TO service_role;
ALTER TABLE public.stayo_central_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY central_checkpoint_read ON public.stayo_central_checkpoints FOR SELECT TO authenticated USING(public.has_admin_role('super_admin','admin'));
COMMENT ON TABLE public.stayo_central_checkpoints IS 'Prepared only: no checkpoint write or automated sync enabled in 10B.2. Full validated round must be committed before future incremental advance.';
