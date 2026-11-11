CREATE OR REPLACE FUNCTION public.admin_linen_apply(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a text:=p_data->>'action'; d linen_documents; total bigint; item jsonb; idx integer; good integer; qty integer;
BEGIN
 IF public.has_admin_role('super_admin','admin','operations','commercial') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 IF a IN ('confirm','correct') THEN
 total:=0;
 FOR item IN SELECT value FROM jsonb_array_elements(p_data#>'{payload,items}') LOOP
 IF (item->>'quantity')::numeric<>(item->>'quantity')::integer OR (item->>'quantity')::integer NOT BETWEEN 1 AND 999 OR (item->>'unitCents')::bigint<0 OR length(coalesce(item->>'name',''))=0 THEN RAISE EXCEPTION 'Item inválido'; END IF;
 total:=total+(item->>'quantity')::integer*(item->>'unitCents')::bigint;
 END LOOP;
 IF total-(p_data#>>'{payload,discountCents}')::bigint+(p_data#>>'{payload,freightCents}')::bigint<>(p_data#>>'{payload,totalCents}')::bigint THEN RAISE EXCEPTION 'Total divergente'; END IF;
 END IF;
 IF a='correct' THEN
 IF length(btrim(coalesce(p_data->>'notes','')))<5 THEN RAISE EXCEPTION 'Informe o motivo da correção'; END IF;
 SELECT * INTO d FROM linen_documents WHERE id=(p_data->>'documentId')::uuid AND implementation_id=(p_data->>'implementationId')::uuid FOR UPDATE;
 IF d.status<>'confirmed' OR d.revision<>(p_data->>'revision')::integer THEN RAISE EXCEPTION 'Reabra o documento atualizado'; END IF;
 IF EXISTS(SELECT 1 FROM linen_events WHERE document_id=d.id AND kind='received') THEN RAISE EXCEPTION 'Pedido com recebimento: registre a divergência sem alterar o pedido'; END IF;
 INSERT INTO linen_events(document_id,implementation_id,kind,payload,actor_id) VALUES(d.id,d.implementation_id,'corrected',jsonb_build_object('before',d.payload,'after',p_data->'payload','notes',p_data->>'notes'),auth.uid());
 UPDATE linen_documents SET payload=p_data->'payload',revision=revision+1 WHERE id=d.id;
 RETURN jsonb_build_object('id',d.id);
 ELSIF a='receive' THEN
 SELECT * INTO d FROM linen_documents WHERE id=(p_data->>'documentId')::uuid AND implementation_id=(p_data->>'implementationId')::uuid FOR UPDATE;
 IF d.id IS NULL OR d.status<>'confirmed' OR d.kind='quote' OR d.revision<>(p_data->>'revision')::integer THEN RAISE EXCEPTION 'Reabra o pedido confirmado'; END IF;
 idx:=(p_data->>'index')::integer; item:=d.payload->'items'->idx;qty:=(p_data->>'quantity')::integer;
 IF item IS NULL OR qty NOT BETWEEN 1 AND 999 OR (p_data->>'condition') NOT IN ('good','defect','mismatch') THEN RAISE EXCEPTION 'Conferência inválida'; END IF;
 SELECT coalesce(sum((payload->>'quantity')::integer),0) INTO good FROM linen_events WHERE document_id=d.id AND kind='received' AND (payload->>'index')::integer=idx AND payload->>'condition'='good';
 IF good+qty>(item->>'quantity')::integer THEN RAISE EXCEPTION 'Quantidade excede o saldo do pedido'; END IF;
 INSERT INTO linen_events(document_id,implementation_id,kind,payload,actor_id) VALUES(d.id,d.implementation_id,'received',p_data-'action',auth.uid());
 UPDATE linen_documents SET revision=revision+1 WHERE id=d.id;
 RETURN jsonb_build_object('id',d.id);
 END IF;
 RETURN public.admin_linen_action(p_data);
END; $$;
REVOKE ALL ON FUNCTION public.admin_linen_apply(jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.admin_linen_apply(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_linen_action(jsonb) FROM authenticated;
COMMENT ON FUNCTION public.admin_linen_action(jsonb) IS 'Internal helper; validated admin_linen_apply is the only authenticated entry point';