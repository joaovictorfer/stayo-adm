CREATE OR REPLACE FUNCTION public.owner_link_write_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_impl uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'anon' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_impl := CASE WHEN TG_OP = 'DELETE' THEN OLD.implementation_id ELSE NEW.implementation_id END;
  IF NOT public.owner_journey_current_confirmed(v_impl) THEN
    RAISE EXCEPTION 'confirme as condições da proposta antes do cadastro';
  END IF;
  -- Envio feito numa transação anterior bloqueia novas gravações pelo link;
  -- o próprio envio (mesma transação, submitted_at = now()) segue normalmente.
  IF EXISTS (SELECT 1 FROM public.owner_onboarding_profiles p
             WHERE p.implementation_id = v_impl AND p.submitted_at < now()) THEN
    RAISE EXCEPTION 'cadastro já enviado para análise';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;