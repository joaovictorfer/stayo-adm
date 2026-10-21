CREATE TABLE public.pagarme_settings_vault (
 id text PRIMARY KEY DEFAULT 'sandbox' CHECK (id = 'sandbox'),
 encrypted_key text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL,
 verified_at timestamptz
);
GRANT ALL ON public.pagarme_settings_vault TO service_role;
REVOKE ALL ON public.pagarme_settings_vault FROM anon, authenticated;
ALTER TABLE public.pagarme_settings_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY pagarme_vault_service ON public.pagarme_settings_vault FOR ALL TO service_role USING (true) WITH CHECK (true);
COMMENT ON TABLE public.pagarme_settings_vault IS 'Encrypted sandbox credentials; server-only after explicit administrator authorization. Never expose encrypted_key through DTOs.';