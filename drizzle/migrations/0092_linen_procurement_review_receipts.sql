CREATE TABLE public.linen_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('quote','order','invoice')), fingerprint text NOT NULL, storage_path text NOT NULL,
 filename text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'review' CHECK(status IN ('review','confirmed')),
 revision integer NOT NULL DEFAULT 1, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz,
 UNIQUE(implementation_id,fingerprint,kind)
);
GRANT SELECT ON public.linen_documents TO authenticated; GRANT ALL ON public.linen_documents TO service_role;
ALTER TABLE public.linen_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY linen_documents_admin ON public.linen_documents FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','operations','commercial'));
CREATE TABLE public.linen_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid REFERENCES public.linen_documents(id) ON DELETE CASCADE,
 implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE, kind text NOT NULL,
 payload jsonb NOT NULL, actor_id uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.linen_events TO authenticated; GRANT ALL ON public.linen_events TO service_role;
ALTER TABLE public.linen_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY linen_events_admin ON public.linen_events FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','operations','commercial'));
CREATE TABLE public.linen_existing (
 implementation_id uuid REFERENCES public.implementation_projects(id) ON DELETE CASCADE, item_key text NOT NULL,
 quantity integer NOT NULL CHECK(quantity BETWEEN 0 AND 999), notes text NOT NULL DEFAULT '', revision integer NOT NULL DEFAULT 1,
 PRIMARY KEY(implementation_id,item_key)
);
GRANT SELECT ON public.linen_existing TO authenticated; GRANT ALL ON public.linen_existing TO service_role;
ALTER TABLE public.linen_existing ENABLE ROW LEVEL SECURITY;
CREATE POLICY linen_existing_admin ON public.linen_existing FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','operations','commercial'));
CREATE TABLE public.linen_rule_versions (id integer PRIMARY KEY, multiplier integer NOT NULL CHECK(multiplier=2), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.linen_rule_versions TO authenticated; GRANT ALL ON public.linen_rule_versions TO service_role;
ALTER TABLE public.linen_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY linen_rule_admin ON public.linen_rule_versions FOR SELECT TO authenticated USING(public.has_admin_role('super_admin','admin','operations','commercial'));
CREATE POLICY linen_storage_admin ON storage.objects FOR SELECT TO authenticated USING(bucket_id='linen-documents' AND public.has_admin_role('super_admin','admin','operations','commercial'));
CREATE OR REPLACE FUNCTION public.admin_linen_action(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.linen_documents; impl uuid; a text:=p_data->>'action'; result uuid; line jsonb; idx integer; qty integer; previous integer; vkey text;
BEGIN
 IF public.has_admin_role('super_admin','admin','operations','commercial') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 impl:=(p_data->>'implementationId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM implementation_projects WHERE id=impl) THEN RAISE EXCEPTION 'Imóvel não encontrado'; END IF;
 IF a='create' THEN
 INSERT INTO linen_documents(implementation_id,kind,fingerprint,storage_path,filename,payload,created_by) VALUES(impl,p_data->>'kind',p_data->>'fingerprint',p_data->>'path',p_data->>'filename',p_data->'payload',auth.uid()) ON CONFLICT(implementation_id,fingerprint,kind) DO NOTHING RETURNING id INTO result;
 IF result IS NULL THEN SELECT id INTO result FROM linen_documents WHERE implementation_id=impl AND fingerprint=p_data->>'fingerprint' AND kind=p_data->>'kind'; END IF;
 RETURN jsonb_build_object('id',result);
 ELSIF a='existing' THEN
 qty:=(p_data->>'quantity')::integer; vkey:=p_data->>'itemKey';
 IF qty NOT BETWEEN 0 AND 999 OR length(vkey)>160 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
 INSERT INTO linen_existing(implementation_id,item_key,quantity,notes) VALUES(impl,vkey,qty,coalesce(p_data->>'notes','')) ON CONFLICT(implementation_id,item_key) DO UPDATE SET quantity=excluded.quantity, notes=excluded.notes, revision=linen_existing.revision+1;
 INSERT INTO linen_events(implementation_id,kind,payload,actor_id) VALUES(impl,'existing',p_data-'action',auth.uid());
 RETURN jsonb_build_object('ok',true);
 END IF;
 SELECT * INTO d FROM linen_documents WHERE id=(p_data->>'documentId')::uuid AND implementation_id=impl FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Documento indisponível'; END IF;
 IF d.revision<>(p_data->>'revision')::integer THEN RAISE EXCEPTION 'Documento atualizado por outra pessoa. Reabra a revisão.'; END IF;
 IF a='confirm' THEN
 IF d.status<>'review' THEN RAISE EXCEPTION 'Pedido já confirmado'; END IF;
 IF jsonb_array_length(p_data#>'{payload,items}')=0 THEN RAISE EXCEPTION 'Pedido sem itens'; END IF;
 UPDATE linen_documents SET payload=p_data->'payload',status='confirmed',confirmed_at=now(),revision=revision+1 WHERE id=d.id;
 INSERT INTO linen_events(document_id,implementation_id,kind,payload,actor_id) VALUES(d.id,impl,'confirmed',p_data->'payload',auth.uid());
 ELSIF a='receive' THEN
 IF d.status<>'confirmed' OR d.kind='quote' THEN RAISE EXCEPTION 'Confirme um pedido antes de receber'; END IF;
 idx:=(p_data->>'index')::integer; line:=d.payload->'items'->idx; qty:=(p_data->>'quantity')::integer;
 IF line IS NULL OR qty<1 OR qty>999 THEN RAISE EXCEPTION 'Item ou quantidade inválida'; END IF;
 SELECT coalesce(sum((payload->>'quantity')::integer),0) INTO previous FROM linen_events WHERE document_id=d.id AND kind='received' AND (payload->>'index')::integer=idx;
 IF qty+previous>(line->>'quantity')::integer THEN RAISE EXCEPTION 'Quantidade excede o pedido'; END IF;
 INSERT INTO linen_events(document_id,implementation_id,kind,payload,actor_id) VALUES(d.id,impl,'received',p_data-'action',auth.uid());
 UPDATE linen_documents SET revision=revision+1 WHERE id=d.id;
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
 RETURN jsonb_build_object('id',d.id);
END; $$;
REVOKE ALL ON FUNCTION public.admin_linen_action(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_linen_action(jsonb) TO authenticated;