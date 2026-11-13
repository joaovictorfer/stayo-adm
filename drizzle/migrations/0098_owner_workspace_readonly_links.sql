CREATE TABLE public.owner_workspace_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id), owner_id uuid NOT NULL REFERENCES public.owner_records(id), token_hash text NOT NULL UNIQUE, snapshot jsonb NOT NULL, expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'), revoked_at timestamptz, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_workspace_links TO authenticated;
GRANT ALL ON public.owner_workspace_links TO service_role;
ALTER TABLE public.owner_workspace_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_workspace_admin_read ON public.owner_workspace_links FOR SELECT TO authenticated USING (public.has_admin_role(VARIADIC ARRAY['super_admin','admin','operations','finance']::public.admin_role[]));
CREATE OR REPLACE FUNCTION public.admin_publish_owner_workspace(p_implementation_id uuid,p_hash text,p_snapshot jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_id uuid;
BEGIN
 IF NOT public.has_admin_role(VARIADIC ARRAY['super_admin','admin','operations','finance']::public.admin_role[]) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 SELECT owner_id INTO v_owner FROM public.implementation_projects WHERE id=p_implementation_id FOR UPDATE;
 IF v_owner IS NULL THEN RAISE EXCEPTION 'Vincule o proprietário antes de publicar'; END IF;
 IF p_hash !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_snapshot) <> 'object' OR (p_snapshot->>'implementationId') IS DISTINCT FROM p_implementation_id::text THEN RAISE EXCEPTION 'Publicação inválida'; END IF;
 UPDATE public.owner_workspace_links SET revoked_at=now() WHERE implementation_id=p_implementation_id AND revoked_at IS NULL;
 INSERT INTO public.owner_workspace_links(implementation_id,owner_id,token_hash,snapshot,created_by) VALUES(p_implementation_id,v_owner,p_hash,p_snapshot,auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.audit_logs(actor_id,event,entity_type,entity_id,metadata) VALUES(auth.uid(),'owner_workspace.published','implementation',p_implementation_id,jsonb_build_object('linkId',v_id));
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_publish_owner_workspace(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_owner_workspace(uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_revoke_owner_workspace(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_admin_role(VARIADIC ARRAY['super_admin','admin','operations','finance']::public.admin_role[]) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 UPDATE public.owner_workspace_links SET revoked_at=now() WHERE id=p_id AND revoked_at IS NULL;
 INSERT INTO public.audit_logs(actor_id,event,entity_type,entity_id) VALUES(auth.uid(),'owner_workspace.revoked','owner_workspace_link',p_id);
END; $$;
REVOKE ALL ON FUNCTION public.admin_revoke_owner_workspace(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_owner_workspace(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.owner_workspace_resolve(p_hash text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT l.snapshot FROM public.owner_workspace_links l JOIN public.implementation_projects p ON p.id=l.implementation_id AND p.owner_id=l.owner_id WHERE l.token_hash=p_hash AND l.revoked_at IS NULL AND l.expires_at>now();
$$;
REVOKE ALL ON FUNCTION public.owner_workspace_resolve(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_workspace_resolve(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.owner_workspace_for_account(p_implementation_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT l.snapshot FROM public.owner_workspace_links l JOIN public.implementation_projects p ON p.id=l.implementation_id AND p.owner_id=l.owner_id WHERE l.implementation_id=p_implementation_id AND l.revoked_at IS NULL AND l.expires_at>now() AND public.owner_can_access_implementation(l.implementation_id) ORDER BY l.created_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.owner_workspace_for_account(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_workspace_for_account(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.owner_workspace_guest_document(p_hash text,p_reservation_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_link public.owner_workspace_links%rowtype; v_document text;
BEGIN
 SELECT l.* INTO v_link FROM public.owner_workspace_links l JOIN public.implementation_projects p ON p.id=l.implementation_id AND p.owner_id=l.owner_id WHERE l.token_hash=p_hash AND l.revoked_at IS NULL AND l.expires_at>now();
 IF NOT FOUND OR NOT public.owner_can_access_implementation(v_link.implementation_id) OR NOT EXISTS(SELECT 1 FROM public.owner_portal_accounts WHERE id=auth.uid() AND role IN ('titular','coproprietario')) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_link.snapshot->'months') m CROSS JOIN LATERAL jsonb_array_elements(m->'reservations') r WHERE r->>'id'=p_reservation_id::text) THEN RAISE EXCEPTION 'Reserva não publicada'; END IF;
 SELECT guest_cpf INTO v_document FROM public.payout_reservations WHERE id=p_reservation_id AND implementation_id=v_link.implementation_id;
 INSERT INTO public.audit_logs(actor_id,event,entity_type,entity_id,metadata) VALUES(auth.uid(),'owner_workspace.guest_document_read','payout_reservation',p_reservation_id,jsonb_build_object('implementationId',v_link.implementation_id));
 RETURN v_document;
END; $$;
REVOKE ALL ON FUNCTION public.owner_workspace_guest_document(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_workspace_guest_document(text,uuid) TO authenticated;