CREATE OR REPLACE FUNCTION public.admin_action_stayo_charge(p_id uuid,p_revision integer,p_action text,p_implementation_id uuid DEFAULT NULL,p_hash text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.stayo_charges; label text;
BEGIN
 IF public.has_admin_role('super_admin','admin','finance') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso financeiro não autorizado'; END IF;
 IF p_revision IS NULL OR p_revision<1 THEN RAISE EXCEPTION 'Revisão obrigatória'; END IF;
 SELECT * INTO c FROM public.stayo_charges WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.revision<>p_revision THEN RAISE EXCEPTION 'Cobrança alterada ou não encontrada. Recarregue'; END IF;
 IF p_action IN ('publish','renew') THEN
  IF (p_action='publish' AND c.state<>'draft') OR (p_action='renew' AND c.state<>'open') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  IF coalesce(p_hash,'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Token inválido'; END IF;
  IF p_action='publish' THEN
   SELECT concat_ws(' · ',coalesce(p.nickname,p.condominium_name,p.code),p.unit) INTO label FROM public.implementation_projects p WHERE p.id=c.implementation_id;
   c.snapshot:=(c.draft-'email'-'internalNotes')||jsonb_build_object('id',c.id,'code','COB-'||lpad(c.code::text,6,'0'),'issued',c.created_at::date,'property',label,'presentedProperty',label);
  END IF;
  c.state:='open'; c.token_hash:=p_hash; c.expires_at:=now()+interval '90 days'; c.revoked_at:=NULL;
 ELSIF p_action='cancel' THEN
  IF c.state='cancelled' THEN RAISE EXCEPTION 'Já cancelada'; END IF;
  c.state:='cancelled'; c.revoked_at:=now();
 ELSIF p_action='revoke' THEN
  IF c.state<>'open' THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  c.revoked_at:=now();
 ELSIF p_action='link' THEN
  c.implementation_id:=p_implementation_id;
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
 UPDATE public.stayo_charges SET state=c.state,implementation_id=c.implementation_id,snapshot=c.snapshot,token_hash=c.token_hash,expires_at=c.expires_at,revoked_at=c.revoked_at,revision=revision+1,updated_at=now(),history=history||jsonb_build_array(CASE p_action WHEN 'publish' THEN 'Demonstrativo publicado' WHEN 'renew' THEN 'Novo link emitido; anterior invalidado' WHEN 'revoke' THEN 'Link revogado' WHEN 'cancel' THEN 'Cobrança cancelada' ELSE 'Vínculo administrativo: '||coalesce(p_implementation_id::text,'avulsa') END||' · '||now()::text) WHERE id=p_id RETURNING * INTO c;
 RETURN public.stayo_charge_dto(c);
END $$;
REVOKE ALL ON FUNCTION public.admin_action_stayo_charge(uuid,integer,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_action_stayo_charge(uuid,integer,text,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_stayo_charge(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.stayo_charges; item jsonb; subtotal bigint:=0; oid uuid; pid uuid; cid uuid; rev integer; clean jsonb;
BEGIN
 IF public.has_admin_role('super_admin','admin','finance') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso financeiro não autorizado'; END IF;
 cid:=(p_data->>'id')::uuid; rev:=(p_data->>'revision')::integer;
 IF cid IS NULL OR rev IS NULL OR rev<0 THEN RAISE EXCEPTION 'Identificador e revisão obrigatórios'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(cid::text,0));
 IF coalesce(length(trim(p_data->>'title')),0) NOT BETWEEN 1 AND 160 OR coalesce(length(trim(p_data->>'recipient')),0) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Título e destinatário obrigatórios'; END IF;
 IF coalesce(p_data->>'email','')<>'' AND (length(p_data->>'email')>254 OR p_data->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Email inválido'; END IF;
 IF coalesce(p_data->>'competence','') !~ '^\d{4}-(0[1-9]|1[0-2])$' OR coalesce(p_data->>'due','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Datas inválidas'; END IF;
 PERFORM (p_data->>'due')::date;
 IF length(coalesce(p_data->>'notes',''))>1000 OR length(coalesce(p_data->>'internalNotes',''))>1000 THEN RAISE EXCEPTION 'Observação excede limite'; END IF;
 IF jsonb_typeof(p_data->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'items') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Itens obrigatórios'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
  IF coalesce(length(trim(item->>'description')),0) NOT BETWEEN 1 AND 250 OR coalesce(length(item->>'id'),0) NOT BETWEEN 1 AND 80 OR coalesce(item->>'quantity','') !~ '^\d+$' OR coalesce(item->>'unitCents','') !~ '^\d+$' THEN RAISE EXCEPTION 'Item inválido'; END IF;
  IF (item->>'quantity')::bigint NOT BETWEEN 1 AND 999 OR (item->>'unitCents')::bigint NOT BETWEEN 1 AND 100000000 THEN RAISE EXCEPTION 'Quantidade/valor inválido'; END IF;
  subtotal:=subtotal+(item->>'quantity')::bigint*(item->>'unitCents')::bigint;
 END LOOP;
 IF subtotal>100000000 THEN RAISE EXCEPTION 'Subtotal excede limite'; END IF;
 oid:=(p_data->>'ownerId')::uuid; pid:=(p_data->>'implementationId')::uuid;
 clean:=jsonb_build_object('title',trim(p_data->>'title'),'recipient',trim(p_data->>'recipient'),'email',coalesce(p_data->>'email',''),'due',p_data->>'due','competence',p_data->>'competence','notes',coalesce(p_data->>'notes',''),'internalNotes',coalesce(p_data->>'internalNotes',''),'items',(SELECT jsonb_agg(jsonb_build_object('id',i->>'id','description',trim(i->>'description'),'quantity',(i->>'quantity')::integer,'unitCents',(i->>'unitCents')::bigint)) FROM jsonb_array_elements(p_data->'items') i));
 SELECT * INTO c FROM public.stayo_charges WHERE id=cid FOR UPDATE;
 IF FOUND THEN
  IF c.state<>'draft' THEN RAISE EXCEPTION 'Cobrança publicada não pode ser editada'; END IF;
  IF c.revision<>rev THEN RAISE EXCEPTION 'Cobrança alterada em outra sessão. Recarregue'; END IF;
  UPDATE public.stayo_charges SET draft=clean,owner_id=oid,implementation_id=pid,revision=revision+1,updated_at=now(),history=history||jsonb_build_array('Rascunho atualizado · '||now()::text) WHERE id=cid RETURNING * INTO c;
 ELSE
  IF rev<>0 THEN RAISE EXCEPTION 'Rascunho não encontrado'; END IF;
  INSERT INTO public.stayo_charges(id,draft,owner_id,implementation_id,created_by,history) VALUES(cid,clean,oid,pid,auth.uid(),jsonb_build_array('Rascunho criado · '||now()::text)) RETURNING * INTO c;
 END IF;
 RETURN public.stayo_charge_dto(c);
END $$;
REVOKE ALL ON FUNCTION public.admin_save_stayo_charge(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_stayo_charge(jsonb) TO authenticated;
