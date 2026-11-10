CREATE TABLE public.payout_payment_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id), competence text NOT NULL, amount_cents bigint NOT NULL CHECK(amount_cents>0), snapshot jsonb NOT NULL, fingerprint text NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', transfer_id uuid UNIQUE REFERENCES public.payout_transfers(id), receipt_path text UNIQUE, receipt_name text, receipt_mime text, receipt_size bigint
);
GRANT SELECT ON public.payout_payment_requests TO authenticated;
GRANT ALL ON public.payout_payment_requests TO service_role;
ALTER TABLE public.payout_payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY payout_requests_finance_read ON public.payout_payment_requests FOR SELECT TO authenticated USING(public.has_admin_role('super_admin','admin','finance'));
CREATE FUNCTION public.admin_payout_context(p_implementation_id uuid,p_competence text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
 IF NOT public.has_admin_role('super_admin','admin','finance') THEN RAISE EXCEPTION 'Acesso financeiro restrito'; END IF;
 IF p_competence !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência inválida'; END IF;
 PERFORM 1 FROM implementation_projects WHERE id=p_implementation_id AND status='ativo' AND core_property_id IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Imóvel não elegível'; END IF;
 SELECT jsonb_build_object('fee',coalesce((SELECT administration_fee FROM implementation_contract_conditions WHERE implementation_id=p_implementation_id),20),'reservations',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM payout_reservations r WHERE implementation_id=p_implementation_id AND to_char(checkin_date,'YYYY-MM')=p_competence),'[]'::jsonb),'expenses',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM property_expenses e WHERE implementation_id=p_implementation_id AND to_char(occurred_on,'YYYY-MM')=p_competence),'[]'::jsonb),'transfers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM payout_transfers t WHERE implementation_id=p_implementation_id AND competence=p_competence),'[]'::jsonb),'recipient',(SELECT jsonb_build_object('name',coalesce(a.account_holder,o.name),'pixType',a.pix_type,'pixKey',a.pix_key,'city',pr.city) FROM implementation_projects p JOIN owner_records o ON o.id=p.owner_id JOIN owner_payout_accounts a ON a.implementation_id=p.id LEFT JOIN owner_onboarding_profiles pr ON pr.implementation_id=p.id WHERE p.id=p_implementation_id)) INTO v;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.admin_payout_context(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_payout_context(uuid,text) TO authenticated;
CREATE FUNCTION public.admin_prepare_payout(p_implementation_id uuid,p_competence text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb; amount bigint; request public.payout_payment_requests;
BEGIN
 v:=admin_payout_context(p_implementation_id,p_competence);
 IF v->'recipient' IS NULL OR v->'recipient'='null'::jsonb THEN RAISE EXCEPTION 'Cadastre titular e chave Pix'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v->'reservations') r WHERE jsonb_array_length(coalesce(nullif(r->'missing_amounts','null'::jsonb),'[]'::jsonb))>0) THEN RAISE EXCEPTION 'Complete os valores financeiros'; END IF;
 SELECT coalesce(sum(greatest(0,(r->>'gross_cents')::bigint-(r->>'cleaning_cents')::bigint-(r->>'platform_fee_cents')::bigint)-round(greatest(0,(r->>'gross_cents')::bigint-(r->>'cleaning_cents')::bigint-(r->>'platform_fee_cents')::bigint)*(v->>'fee')::numeric/100)),0) INTO amount FROM jsonb_array_elements(v->'reservations') r WHERE r->>'payout_flow'='stayo';
 amount:=amount-coalesce((SELECT sum((e->>'amount_cents')::bigint) FROM jsonb_array_elements(v->'expenses') e WHERE (e->>'charged_to_owner')::boolean),0)-coalesce((SELECT sum((t->>'amount_cents')::bigint) FROM jsonb_array_elements(v->'transfers') t),0);
 IF amount<=0 THEN RAISE EXCEPTION 'Não há saldo a repassar'; END IF;
 INSERT INTO payout_payment_requests(implementation_id,competence,amount_cents,snapshot,fingerprint,created_by) VALUES(p_implementation_id,p_competence,amount,v,md5(v::text),auth.uid()) RETURNING * INTO request;
 RETURN to_jsonb(request);
END $$;
REVOKE ALL ON FUNCTION public.admin_prepare_payout(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_prepare_payout(uuid,text) TO authenticated;
CREATE FUNCTION public.admin_finalize_payout(p_request_id uuid,p_amount bigint,p_paid_on date,p_path text,p_name text,p_mime text,p_size bigint) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage AS $$
DECLARE r public.payout_payment_requests; v jsonb; t uuid;
BEGIN
 IF NOT public.has_admin_role('super_admin','admin','finance') THEN RAISE EXCEPTION 'Acesso financeiro restrito'; END IF;
 SELECT * INTO r FROM public.payout_payment_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Repasse não encontrado'; END IF;
 IF r.transfer_id IS NOT NULL THEN RETURN r.transfer_id; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.implementation_id::text||r.competence,0));
 v:=public.admin_payout_context(r.implementation_id,r.competence);
 IF r.expires_at<now() OR md5(v::text)<>r.fingerprint THEN RAISE EXCEPTION 'O fechamento ou a chave mudou. Gere o Pix novamente'; END IF;
 IF p_amount<=0 OR p_amount>r.amount_cents OR p_paid_on IS NULL OR p_paid_on>current_date THEN RAISE EXCEPTION 'Valor ou data inválidos'; END IF;
 IF p_size<=0 OR p_size>10485760 OR p_mime NOT IN ('application/pdf','image/jpeg','image/png') OR p_path<>r.implementation_id::text||'/'||r.id::text||'/receipt' OR length(p_name)>200 THEN RAISE EXCEPTION 'Comprovante inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='payout-receipts' AND name=p_path) THEN RAISE EXCEPTION 'Comprovante não salvo'; END IF;
 INSERT INTO public.payout_transfers(implementation_id,competence,paid_on,amount_cents,method,created_by) VALUES(r.implementation_id,r.competence,p_paid_on,p_amount,'pix',auth.uid()) RETURNING id INTO t;
 UPDATE public.payout_payment_requests SET transfer_id=t,receipt_path=p_path,receipt_name=p_name,receipt_mime=p_mime,receipt_size=p_size WHERE id=r.id;
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.admin_finalize_payout(uuid,bigint,date,text,text,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_finalize_payout(uuid,bigint,date,text,text,text,bigint) TO authenticated;
CREATE POLICY payout_receipts_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='payout-receipts' AND public.has_admin_role('super_admin','admin','finance'));
CREATE POLICY payout_receipts_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='payout-receipts' AND public.has_admin_role('super_admin','admin','finance') AND EXISTS(SELECT 1 FROM public.payout_payment_requests r WHERE r.transfer_id IS NULL AND r.expires_at>now() AND r.created_by=auth.uid() AND name=r.implementation_id::text||'/'||r.id::text||'/receipt'));
CREATE POLICY payout_receipts_remove_pending ON storage.objects FOR DELETE TO authenticated USING(bucket_id='payout-receipts' AND public.has_admin_role('super_admin','admin','finance') AND EXISTS(SELECT 1 FROM public.payout_payment_requests r WHERE r.transfer_id IS NULL AND r.created_by=auth.uid() AND name=r.implementation_id::text||'/'||r.id::text||'/receipt'));
CREATE FUNCTION public.payout_receipt_transfer_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.payout_payment_requests WHERE transfer_id=OLD.id) THEN RAISE EXCEPTION 'Repasse com comprovante preservado no histórico'; END IF; RETURN OLD; END $$;
CREATE TRIGGER payout_receipt_transfer_guard BEFORE UPDATE OR DELETE ON public.payout_transfers FOR EACH ROW EXECUTE FUNCTION public.payout_receipt_transfer_immutable();