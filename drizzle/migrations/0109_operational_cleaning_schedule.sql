ALTER TABLE public.op_tasks ADD COLUMN cleaning_date_override boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.admin_schedule_cleaning(p_task_id uuid, p_date date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.op_tasks; r public.payout_reservations; next_in date;
BEGIN
 IF public.has_admin_role('super_admin','admin','operations') IS NOT TRUE THEN RAISE EXCEPTION 'Sem permissão para organizar limpeza'; END IF;
 SELECT * INTO t FROM public.op_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR t.kind<>'limpeza' OR t.status NOT IN ('pendente','em_andamento') THEN RAISE EXCEPTION 'Rotina indisponível'; END IF;
 IF p_date IS NULL THEN RAISE EXCEPTION 'Informe a data'; END IF;
 IF t.payout_reservation_id IS NOT NULL THEN
  SELECT * INTO r FROM public.payout_reservations WHERE id=t.payout_reservation_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva indisponível'; END IF;
  SELECT min(checkin_date) INTO next_in FROM public.payout_reservations WHERE implementation_id=r.implementation_id AND id<>r.id AND checkin_date>=r.checkout_date;
  IF p_date<r.checkout_date OR (next_in IS NOT NULL AND p_date>next_in) THEN RAISE EXCEPTION 'Limpeza deve ocorrer entre a saída e a próxima entrada'; END IF;
 END IF;
 UPDATE public.op_tasks SET due_date=p_date,cleaning_date_override=true WHERE id=t.id;
END $$;
REVOKE ALL ON FUNCTION public.admin_schedule_cleaning(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_schedule_cleaning(uuid,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.op_reservation_routine_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_amount numeric;
BEGIN
 IF TG_OP='DELETE' THEN
  DELETE FROM public.op_tasks WHERE payout_reservation_id=OLD.id AND status='pendente';
  RETURN OLD;
 END IF;
 IF NEW.checkout_date IS NULL OR NEW.implementation_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.op_tasks WHERE payout_reservation_id=NEW.id) THEN
  UPDATE public.op_tasks SET due_date=CASE WHEN cleaning_date_override THEN due_date ELSE NEW.checkout_date END,implementation_id=NEW.implementation_id
   WHERE payout_reservation_id=NEW.id AND status='pendente' AND ((NOT cleaning_date_override AND due_date IS DISTINCT FROM NEW.checkout_date) OR implementation_id IS DISTINCT FROM NEW.implementation_id);
  RETURN NEW;
 END IF;
 IF NEW.checkout_date<(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RETURN NEW; END IF;
 SELECT default_total_amount INTO v_amount FROM public.op_routine_rules WHERE active AND routine_type='limpeza_pre_checkin' ORDER BY (scope_type='global') LIMIT 1;
 INSERT INTO public.op_tasks(title,kind,implementation_id,due_date,priority,status,amount,payout_reservation_id)
 VALUES('Limpeza pós check-out','limpeza',NEW.implementation_id,NEW.checkout_date,'media','pendente',v_amount,NEW.id)
 ON CONFLICT(payout_reservation_id) WHERE payout_reservation_id IS NOT NULL DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.op_reservation_routine_sync() FROM PUBLIC,anon,authenticated;