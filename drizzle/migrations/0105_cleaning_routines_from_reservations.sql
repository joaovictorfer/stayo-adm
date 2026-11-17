ALTER TABLE public.op_tasks ADD COLUMN payout_reservation_id uuid REFERENCES public.payout_reservations(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX op_tasks_one_routine_per_reservation ON public.op_tasks(payout_reservation_id) WHERE payout_reservation_id IS NOT NULL;
COMMENT ON COLUMN public.op_tasks.payout_reservation_id IS 'Reservation that generated this checkout cleaning routine; one routine per reservation.';

CREATE OR REPLACE FUNCTION public.op_reservation_routine_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.op_tasks WHERE payout_reservation_id = OLD.id AND status = 'pendente';
    RETURN OLD;
  END IF;
  IF NEW.checkout_date IS NULL OR NEW.implementation_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.op_tasks WHERE payout_reservation_id = NEW.id) THEN
    UPDATE public.op_tasks SET due_date = NEW.checkout_date, implementation_id = NEW.implementation_id
      WHERE payout_reservation_id = NEW.id AND status = 'pendente'
        AND (due_date IS DISTINCT FROM NEW.checkout_date OR implementation_id IS DISTINCT FROM NEW.implementation_id);
    RETURN NEW;
  END IF;
  SELECT default_total_amount INTO v_amount FROM public.op_routine_rules
    WHERE active AND routine_type = 'limpeza_pre_checkin' ORDER BY (scope_type = 'global') LIMIT 1;
  INSERT INTO public.op_tasks (title, kind, implementation_id, due_date, priority, status, amount, payout_reservation_id)
  VALUES ('Limpeza pós check-out', 'limpeza', NEW.implementation_id, NEW.checkout_date, 'media', 'pendente', v_amount, NEW.id)
  ON CONFLICT (payout_reservation_id) WHERE payout_reservation_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.op_reservation_routine_sync() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER op_reservation_routine_ins AFTER INSERT OR UPDATE OF checkout_date, implementation_id ON public.payout_reservations
  FOR EACH ROW EXECUTE FUNCTION public.op_reservation_routine_sync();
CREATE TRIGGER op_reservation_routine_del BEFORE DELETE ON public.payout_reservations
  FOR EACH ROW EXECUTE FUNCTION public.op_reservation_routine_sync();

INSERT INTO public.op_tasks (title, kind, implementation_id, due_date, priority, status, amount, payout_reservation_id)
SELECT 'Limpeza pós check-out', 'limpeza', r.implementation_id, r.checkout_date, 'media', 'pendente',
  (SELECT default_total_amount FROM public.op_routine_rules WHERE active AND routine_type = 'limpeza_pre_checkin' LIMIT 1), r.id
FROM public.payout_reservations r
WHERE r.checkout_date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AND r.implementation_id IS NOT NULL
ON CONFLICT (payout_reservation_id) WHERE payout_reservation_id IS NOT NULL DO NOTHING;