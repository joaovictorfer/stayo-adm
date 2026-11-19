CREATE TABLE public.op_reservation_preparation (
 reservation_id uuid NOT NULL REFERENCES public.payout_reservations(id) ON DELETE CASCADE,
 item text NOT NULL CHECK(item IN ('limpeza','kit','enxoval','vistoria','condominio')),
 checked boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid,
 PRIMARY KEY(reservation_id,item)
);
GRANT SELECT ON public.op_reservation_preparation TO authenticated;
GRANT ALL ON public.op_reservation_preparation TO service_role;
ALTER TABLE public.op_reservation_preparation ENABLE ROW LEVEL SECURITY;
CREATE POLICY preparation_read ON public.op_reservation_preparation FOR SELECT TO authenticated USING(public.has_admin_role('super_admin','admin','operations'));
CREATE FUNCTION public.admin_toggle_reservation_preparation(p_reservation uuid,p_item text,p_checked boolean,p_previous boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_current boolean;
BEGIN
 IF public.has_admin_role('super_admin','admin','operations') IS NOT TRUE THEN RAISE EXCEPTION 'Sem permissão para preparar reservas'; END IF;
 IF p_item NOT IN ('limpeza','kit','enxoval','vistoria','condominio') OR p_item IS NULL OR p_checked IS NULL OR p_previous IS NULL THEN RAISE EXCEPTION 'Item inválido'; END IF;
 PERFORM 1 FROM public.payout_reservations WHERE id=p_reservation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
 SELECT checked INTO v_current FROM public.op_reservation_preparation WHERE reservation_id=p_reservation AND item=p_item;
 IF coalesce(v_current,false) IS DISTINCT FROM p_previous THEN RAISE EXCEPTION 'Este item foi alterado por outra pessoa. Atualize a reserva.'; END IF;
 INSERT INTO public.op_reservation_preparation(reservation_id,item,checked,updated_by) VALUES(p_reservation,p_item,p_checked,auth.uid())
 ON CONFLICT(reservation_id,item) DO UPDATE SET checked=EXCLUDED.checked,updated_by=EXCLUDED.updated_by,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.admin_toggle_reservation_preparation(uuid,text,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_reservation_preparation(uuid,text,boolean,boolean) TO authenticated;