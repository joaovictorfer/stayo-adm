CREATE TABLE public.property_history_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN ('implantacao','reserva','compra','manutencao','higienizacao','vistoria','ocorrencia')),
 phase text NOT NULL CHECK(phase IN ('implantacao','operacao')), title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 180),
 supply_id uuid UNIQUE REFERENCES public.implementation_supply_items(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES auth.users(id)
);
GRANT SELECT ON public.property_history_cases TO authenticated; GRANT ALL ON public.property_history_cases TO service_role;
ALTER TABLE public.property_history_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_cases_read ON public.property_history_cases FOR SELECT TO authenticated USING(public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer') IS TRUE);
CREATE TABLE public.property_history_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.property_history_cases(id) ON DELETE CASCADE,
 request_id uuid NOT NULL UNIQUE, revision integer NOT NULL, occurred_at timestamptz NOT NULL, date_only boolean NOT NULL DEFAULT false,
 status text NOT NULL CHECK(status IN ('aberta','agendada','em_andamento','aguardando_entrega','parcial','recebido','pendencia','concluido','cancelado')),
 description text NOT NULL DEFAULT '', responsible text NOT NULL DEFAULT '', room text NOT NULL DEFAULT '', supplier text NOT NULL DEFAULT '',
 expected_qty integer CHECK(expected_qty >= 0), received_qty integer CHECK(received_qty >= 0), checked_qty integer CHECK(checked_qty >= 0),
 expected_date date, amount_cents bigint CHECK(amount_cents >= 0), correction_reason text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES auth.users(id), UNIQUE(case_id,revision),
 CHECK(received_qty IS NULL OR expected_qty IS NULL OR received_qty <= expected_qty),
 CHECK(checked_qty IS NULL OR received_qty IS NULL OR checked_qty <= received_qty)
);
GRANT SELECT ON public.property_history_events TO authenticated; GRANT ALL ON public.property_history_events TO service_role;
ALTER TABLE public.property_history_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_events_read ON public.property_history_events FOR SELECT TO authenticated USING(public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer') IS TRUE);
CREATE INDEX property_history_cases_property ON public.property_history_cases(implementation_id);
CREATE INDEX property_history_events_date ON public.property_history_events(occurred_at DESC);
CREATE OR REPLACE FUNCTION public.admin_record_property_history(p_input jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_case uuid; v_id uuid; v_revision integer; v_category text;
BEGIN
 IF public.has_admin_role('super_admin','admin','commercial','operations') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 SELECT id INTO v_id FROM public.property_history_events WHERE request_id=(p_input->>'request_id')::uuid;
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 v_case:=nullif(p_input->>'case_id','')::uuid;
 IF v_case IS NULL THEN
 INSERT INTO public.property_history_cases(implementation_id,category,phase,title,created_by) VALUES((p_input->>'implementation_id')::uuid,p_input->>'category',p_input->>'phase',p_input->>'title',auth.uid()) RETURNING id INTO v_case;
 ELSE
 PERFORM 1 FROM public.property_history_cases WHERE id=v_case AND implementation_id=(p_input->>'implementation_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado'; END IF;
 END IF;
 SELECT category INTO v_category FROM public.property_history_cases WHERE id=v_case;
 SELECT coalesce(max(revision),0) INTO v_revision FROM public.property_history_events WHERE case_id=v_case;
 IF v_revision<>coalesce((p_input->>'revision')::integer,0) THEN RAISE EXCEPTION 'O histórico mudou. Recarregue antes de salvar.'; END IF;
 IF v_category='compra' AND p_input->>'status'='concluido' AND (nullif(p_input->>'expected_qty','') IS NULL OR (p_input->>'expected_qty')::integer<=0 OR (p_input->>'checked_qty')::integer IS DISTINCT FROM (p_input->>'expected_qty')::integer OR (p_input->>'received_qty')::integer IS DISTINCT FROM (p_input->>'expected_qty')::integer) THEN RAISE EXCEPTION 'Confira toda a quantidade antes de concluir a compra'; END IF;
 IF p_input->>'status'='cancelado' AND length(btrim(coalesce(p_input->>'description',''))) = 0 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
 IF coalesce((p_input->>'is_correction')::boolean,false) AND length(btrim(coalesce(p_input->>'correction_reason','')))=0 THEN RAISE EXCEPTION 'Informe o motivo da retificação'; END IF;
 INSERT INTO public.property_history_events(case_id,request_id,revision,occurred_at,date_only,status,description,responsible,room,supplier,expected_qty,received_qty,checked_qty,expected_date,amount_cents,correction_reason,created_by)
 VALUES(v_case,(p_input->>'request_id')::uuid,v_revision+1,(p_input->>'occurred_at')::timestamptz,coalesce((p_input->>'date_only')::boolean,false),p_input->>'status',coalesce(p_input->>'description',''),coalesce(p_input->>'responsible',''),coalesce(p_input->>'room',''),coalesce(p_input->>'supplier',''),nullif(p_input->>'expected_qty','')::integer,nullif(p_input->>'received_qty','')::integer,nullif(p_input->>'checked_qty','')::integer,nullif(p_input->>'expected_date','')::date,nullif(p_input->>'amount_cents','')::bigint,coalesce(p_input->>'correction_reason',''),auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_record_property_history(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_record_property_history(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.capture_supply_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_case uuid; v_revision integer; v_phase text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.procurement_stage IS NOT DISTINCT FROM OLD.procurement_stage AND NEW.existing_qty IS NOT DISTINCT FROM OLD.existing_qty AND NEW.required_qty IS NOT DISTINCT FROM OLD.required_qty AND NEW.supplier IS NOT DISTINCT FROM OLD.supplier THEN RETURN NEW; END IF;
 SELECT CASE WHEN status='ativo' THEN 'operacao' ELSE 'implantacao' END INTO v_phase FROM public.implementation_projects WHERE id=NEW.implementation_id;
 INSERT INTO public.property_history_cases(implementation_id,category,phase,title,supply_id,created_by) VALUES(NEW.implementation_id,'compra',v_phase,NEW.name,NEW.id,auth.uid()) ON CONFLICT(supply_id) DO NOTHING;
 SELECT id INTO v_case FROM public.property_history_cases WHERE supply_id=NEW.id FOR UPDATE;
 SELECT coalesce(max(revision),0)+1 INTO v_revision FROM public.property_history_events WHERE case_id=v_case;
 INSERT INTO public.property_history_events(case_id,request_id,revision,occurred_at,status,description,room,supplier,expected_qty,created_by)
 VALUES(v_case,gen_random_uuid(),v_revision,now(),CASE WHEN NEW.procurement_stage='aguardando_servico' THEN 'aguardando_entrega' WHEN NEW.procurement_stage='concluido' THEN 'pendencia' ELSE 'aberta' END,'Inventário atualizado · etapa: '||NEW.procurement_stage||' · quantidade existente: '||NEW.existing_qty,coalesce(NEW.room,''),coalesce(NEW.supplier,''),NEW.required_qty,auth.uid());
 RETURN NEW;
END $$;
CREATE TRIGGER supply_property_history AFTER INSERT OR UPDATE OF procurement_stage,existing_qty,required_qty,supplier ON public.implementation_supply_items FOR EACH ROW EXECUTE FUNCTION public.capture_supply_history();