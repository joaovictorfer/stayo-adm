ALTER POLICY payout_receipts_insert ON storage.objects WITH CHECK (false);
ALTER POLICY payout_receipts_remove_pending ON storage.objects USING (false);
CREATE OR REPLACE FUNCTION public.admin_finalize_payout(p_request_id uuid,p_amount bigint,p_paid_on date,p_path text,p_name text,p_mime text,p_size bigint) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage AS $$
DECLARE r public.payout_payment_requests; v jsonb; t uuid;
BEGIN
 IF NOT public.has_admin_role('super_admin','admin','finance') THEN RAISE EXCEPTION 'Acesso financeiro restrito'; END IF;
 SELECT * INTO r FROM public.payout_payment_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.created_by<>auth.uid() THEN RAISE EXCEPTION 'Repasse não encontrado'; END IF;
 IF r.transfer_id IS NOT NULL THEN RETURN r.transfer_id; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.implementation_id::text||r.competence,0));
 v:=public.admin_payout_context(r.implementation_id,r.competence);
 IF r.expires_at<now() OR md5(v::text)<>r.fingerprint THEN RAISE EXCEPTION 'O fechamento ou a chave mudou. Gere o Pix novamente'; END IF;
 IF p_amount<=0 OR p_amount>r.amount_cents OR p_paid_on IS NULL OR p_paid_on>current_date THEN RAISE EXCEPTION 'Valor ou data inválidos'; END IF;
 IF p_size<=0 OR p_size>10485760 OR p_mime NOT IN ('application/pdf','image/jpeg','image/png') OR p_path<>r.implementation_id::text||'/'||r.id::text||'/receipt' OR length(p_name)>200 THEN RAISE EXCEPTION 'Comprovante inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='payout-receipts' AND name=p_path AND (metadata->>'size')::bigint=p_size AND metadata->>'mimetype'=p_mime) THEN RAISE EXCEPTION 'Comprovante não salvo ou divergente'; END IF;
 INSERT INTO public.payout_transfers(implementation_id,competence,paid_on,amount_cents,method,created_by) VALUES(r.implementation_id,r.competence,p_paid_on,p_amount,'pix',auth.uid()) RETURNING id INTO t;
 UPDATE public.payout_payment_requests SET transfer_id=t,receipt_path=p_path,receipt_name=p_name,receipt_mime=p_mime,receipt_size=p_size WHERE id=r.id;
 RETURN t;
END $$;