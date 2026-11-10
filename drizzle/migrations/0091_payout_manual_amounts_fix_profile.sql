CREATE OR REPLACE FUNCTION public.admin_adjust_payout_amounts(_reservation_id uuid, _amounts jsonb, _confirm_amounts jsonb, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.payout_reservations%ROWTYPE;
  k text; v bigint; prev bigint; was_missing boolean; n int := 0;
  who text;
BEGIN
  IF NOT public.has_admin_role(VARIADIC ARRAY['super_admin'::admin_role,'admin'::admin_role,'finance'::admin_role]) THEN
    RAISE EXCEPTION 'Sem permissão para ajustar valores de repasse';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'Informe o motivo do ajuste'; END IF;
  IF _amounts IS NULL OR jsonb_typeof(_amounts) <> 'object' OR _amounts = '{}'::jsonb THEN RAISE EXCEPTION 'Nenhum valor informado'; END IF;
  IF _confirm_amounts IS DISTINCT FROM _amounts THEN RAISE EXCEPTION 'A confirmação não confere com os valores digitados'; END IF;
  SELECT * INTO r FROM public.payout_reservations WHERE id = _reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
  SELECT full_name INTO who FROM public.admin_profiles WHERE id = auth.uid();
  FOR k IN SELECT jsonb_object_keys(_amounts) LOOP
    IF k NOT IN ('gross','cleaning','platform_fee','owner_direct') THEN RAISE EXCEPTION 'Campo inválido: %', k; END IF;
    IF k = 'owner_direct' AND r.payout_flow <> 'platform_auto' THEN RAISE EXCEPTION 'Recebimento direto só vale para repasse pela plataforma'; END IF;
    IF jsonb_typeof(_amounts->k) <> 'number' THEN RAISE EXCEPTION 'Valor inválido'; END IF;
    v := (_amounts->>k)::bigint;
    IF v < 0 OR v > 100000000 THEN RAISE EXCEPTION 'Valor fora do limite'; END IF;
    was_missing := k = ANY(r.missing_amounts);
    prev := CASE k WHEN 'gross' THEN r.gross_cents WHEN 'cleaning' THEN r.cleaning_cents WHEN 'platform_fee' THEN r.platform_fee_cents ELSE r.owner_direct_cents END;
    IF NOT was_missing AND prev = v THEN CONTINUE; END IF;
    INSERT INTO public.payout_reservation_adjustments(reservation_id, implementation_id, reservation_code, competence, field, previous_cents, previous_missing, new_cents, reason, created_by, created_by_name)
    VALUES (r.id, r.implementation_id, r.reservation_code, to_char(r.checkin_date,'YYYY-MM'), k, CASE WHEN was_missing THEN NULL ELSE prev END, was_missing, v, btrim(_reason), auth.uid(), who);
    UPDATE public.payout_reservations SET
      gross_cents = CASE WHEN k='gross' THEN v ELSE gross_cents END,
      cleaning_cents = CASE WHEN k='cleaning' THEN v ELSE cleaning_cents END,
      platform_fee_cents = CASE WHEN k='platform_fee' THEN v ELSE platform_fee_cents END,
      owner_direct_cents = CASE WHEN k='owner_direct' THEN v ELSE owner_direct_cents END,
      missing_amounts = array_remove(missing_amounts, k),
      manual_amounts = CASE WHEN k = ANY(manual_amounts) THEN manual_amounts ELSE manual_amounts || k END,
      updated_at = now()
    WHERE id = r.id;
    SELECT * INTO r FROM public.payout_reservations WHERE id = _reservation_id;
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('changed', n);
END $$;