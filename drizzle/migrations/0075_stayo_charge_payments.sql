ALTER TABLE public.stayo_charges ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS paid_method text, ADD COLUMN IF NOT EXISTS paid_amount_cents integer;
CREATE TABLE public.stayo_charge_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 charge_id uuid NOT NULL REFERENCES public.stayo_charges(id),
 method text NOT NULL CHECK (method IN ('pix','card')),
 amount_cents integer NOT NULL CHECK (amount_cents > 0),
 provider_order_id text UNIQUE,
 status text NOT NULL DEFAULT 'pending',
 qr_code text, qr_code_url text, checkout_url text,
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stayo_charge_payments TO authenticated;
GRANT ALL ON public.stayo_charge_payments TO service_role;
ALTER TABLE public.stayo_charge_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY charge_payments_finance_read ON public.stayo_charge_payments FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','finance'));
CREATE INDEX stayo_charge_payments_charge ON public.stayo_charge_payments(charge_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.stayo_charge_dto(c public.stayo_charges) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT c.draft || jsonb_build_object('id',c.id,'code','COB-'||lpad(c.code::text,6,'0'),'revision',c.revision,'status',c.state,'paymentStatus',CASE WHEN c.paid_at IS NOT NULL THEN 'paid' ELSE 'pending' END,'paidAt',c.paid_at,'paidMethod',c.paid_method,'paidAmountCents',c.paid_amount_cents,'ownerId',c.owner_id,'implementationId',c.implementation_id,'property',(SELECT concat_ws(' · ',coalesce(p.nickname,p.condominium_name,p.code),p.unit) FROM public.implementation_projects p WHERE p.id=c.implementation_id),'presentedProperty',c.snapshot->'presentedProperty','issued',c.created_at::date,'history',c.history,'linkExpiresAt',c.expires_at,'linkRevoked',c.revoked_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.stayo_charge_dto(public.stayo_charges) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.public_stayo_charge(p_hash text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.snapshot||jsonb_build_object('status',c.state,'paymentStatus',CASE WHEN c.paid_at IS NOT NULL THEN 'paid' ELSE 'pending' END,'paidMethod',c.paid_method,'paidAmountCents',c.paid_amount_cents,'internalNotes','','email','','history','[]'::jsonb)
 FROM public.stayo_charges c WHERE c.token_hash=p_hash AND length(p_hash)=64 AND c.state='open' AND c.revoked_at IS NULL AND c.expires_at>now();
$$;
REVOKE ALL ON FUNCTION public.public_stayo_charge(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_stayo_charge(text) TO anon, authenticated;
-- block cancelling a paid charge
CREATE OR REPLACE FUNCTION public.stayo_charges_paid_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF OLD.paid_at IS NOT NULL AND NEW.state='cancelled' THEN RAISE EXCEPTION 'Cobrança paga não pode ser cancelada'; END IF; RETURN NEW; END $$;
CREATE TRIGGER stayo_charges_paid_guard BEFORE UPDATE ON public.stayo_charges FOR EACH ROW EXECUTE FUNCTION public.stayo_charges_paid_guard();