-- Leitura mínima da próxima reunião para o proprietário da implantação.
-- O link só é entregue perto do horário (2h antes até o fim), nunca antes.
CREATE OR REPLACE FUNCTION public.owner_next_meeting(p_implementation_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE m public.implementation_commercial_meetings;
BEGIN
  IF NOT (public.owner_can_access_implementation(p_implementation_id)
          OR public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer')) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO m FROM public.implementation_commercial_meetings
  WHERE implementation_id = p_implementation_id
    AND status IN ('scheduled','confirmed')
    AND coalesce(ends_at, starts_at + interval '1 hour') > now()
  ORDER BY starts_at LIMIT 1;
  IF m.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'startsAt', m.starts_at, 'endsAt', m.ends_at, 'timeZone', m.time_zone, 'mode', m.mode,
    'joinUrl', CASE WHEN m.mode = 'video' AND now() >= m.starts_at - interval '2 hours' THEN m.join_url END,
    'hasJoinUrl', m.join_url IS NOT NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_next_meeting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_next_meeting(uuid) TO authenticated;