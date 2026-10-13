-- 0025 · Plataformas liberadas por imóvel
-- A STAYO pode definir, na ficha do Imóvel, onde aquele imóvel será anunciado
-- (ex.: só Airbnb). NULL mantém todos os canais liberados, como era antes.
-- `distribution_channels` continua sendo a escolha do proprietário, gravada
-- apenas por `owner_platforms_save`; aqui nasce só a liberação administrativa.

ALTER TABLE public.implementation_projects
  ADD COLUMN IF NOT EXISTS allowed_channels text[];

ALTER TABLE public.implementation_projects
  ADD CONSTRAINT implementation_projects_allowed_channels_known
  CHECK (allowed_channels IS NULL OR allowed_channels <@ ARRAY['airbnb','booking','decolar','direct']::text[]);

COMMENT ON COLUMN public.implementation_projects.allowed_channels IS
  'Canais de distribuição liberados pela STAYO para este imóvel; NULL = todos. distribution_channels segue sendo a escolha do proprietário.';

-- Canais fora da liberação não permanecem gravados na escolha do proprietário.
CREATE OR REPLACE FUNCTION public.prune_distribution_channels_to_allowed()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.allowed_channels IS DISTINCT FROM OLD.allowed_channels AND NEW.allowed_channels IS NOT NULL THEN
    NEW.distribution_channels := (
      SELECT array_agg(c ORDER BY array_position(ARRAY['airbnb','booking','decolar','direct'], c))
      FROM (
        SELECT DISTINCT c
        FROM unnest(coalesce(NEW.distribution_channels,'{}')) c
        WHERE c = ANY(NEW.allowed_channels) OR c = 'airbnb'
      ) s
    );
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER implementation_channels_prune
  BEFORE UPDATE OF allowed_channels ON public.implementation_projects
  FOR EACH ROW EXECUTE FUNCTION public.prune_distribution_channels_to_allowed();

-- A liberação passa a ter o mesmo rastro de origem dos demais campos cadastrais.
CREATE OR REPLACE FUNCTION public.track_implementation_field_sources()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  f text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_src text := case when public.has_admin_role('super_admin','admin','commercial','operations','finance') then 'admin' else 'owner' end;
begin
  foreach f in array array['nickname','condominium_name','tower','unit','address','city','postal_code','property_type','bedrooms','capacity','notes','owner_facing_notes','cover_source','allowed_channels'] loop
    if (v_old->f) is distinct from (v_new->f) then
      insert into public.implementation_field_sources (implementation_id, field, source, actor_id, updated_at)
      values (new.id, f, v_src, auth.uid(), now())
      on conflict (implementation_id, field) do update
        set source = excluded.source, actor_id = excluded.actor_id, updated_at = excluded.updated_at;
    end if;
  end loop;
  return new;
end;
$function$;

-- A jornada precisa saber o que está liberado para desativar o resto.
CREATE OR REPLACE FUNCTION public.owner_platforms_resolve(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_inv public.owner_portal_invitations%rowtype; v_row public.implementation_projects%rowtype;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  SELECT * INTO v_inv FROM public.owner_portal_invitations WHERE token_hash = encode(digest(p_token,'sha256'),'hex');
  IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at < now() THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  IF NOT public.owner_journey_current_confirmed(v_inv.implementation_id) THEN RAISE EXCEPTION 'proposta não confirmada'; END IF;
  SELECT * INTO v_row FROM public.implementation_projects WHERE id = v_inv.implementation_id;
  RETURN jsonb_build_object(
    'channels', to_jsonb(v_row.distribution_channels),
    'airbnbEmail', v_row.airbnb_account_email,
    'allowedChannels', to_jsonb(v_row.allowed_channels)
  );
END
$function$;

-- Salvar continua recusando canal inexistente e agora também recusa canal não liberado.
CREATE OR REPLACE FUNCTION public.owner_platforms_save(p_token text, p_channels text[], p_airbnb_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_inv public.owner_portal_invitations%rowtype; v_channels text[]; v_email text := lower(nullif(trim(p_airbnb_email),'')); v_allowed text[];
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 OR char_length(p_token) > 200 THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  SELECT * INTO v_inv FROM public.owner_portal_invitations WHERE token_hash = encode(digest(p_token,'sha256'),'hex');
  IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at < now() THEN RAISE EXCEPTION 'acesso inválido'; END IF;
  IF NOT public.owner_journey_current_confirmed(v_inv.implementation_id) THEN RAISE EXCEPTION 'proposta não confirmada'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_channels,'{}')) c WHERE c NOT IN ('airbnb','booking','decolar','direct')) THEN RAISE EXCEPTION 'canal inválido'; END IF;
  IF v_email IS NOT NULL AND (char_length(v_email) > 255 OR v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$') THEN RAISE EXCEPTION 'e-mail inválido'; END IF;

  SELECT ip.allowed_channels INTO v_allowed
    FROM public.implementation_projects ip
   WHERE ip.id = v_inv.implementation_id;
  IF v_allowed IS NOT NULL AND NOT ('airbnb' = ANY(v_allowed)) THEN
    v_allowed := array_append(v_allowed, 'airbnb');
  END IF;
  IF v_allowed IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(coalesce(p_channels,'{}')) c WHERE NOT (c = ANY(v_allowed))
  ) THEN
    RAISE EXCEPTION 'canal não liberado para este imóvel';
  END IF;

  SELECT array_agg(c ORDER BY array_position(ARRAY['airbnb','booking','decolar','direct'], c)) INTO v_channels
  FROM (SELECT DISTINCT c FROM unnest(array_append(coalesce(p_channels,'{}'),'airbnb')) c) s;
  UPDATE public.implementation_projects
     SET distribution_channels = v_channels, airbnb_account_email = v_email,
         distribution_updated_at = now(), distribution_updated_by = 'owner'
   WHERE id = v_inv.implementation_id;
  RETURN jsonb_build_object('channels', to_jsonb(v_channels), 'airbnbEmail', v_email, 'allowedChannels', to_jsonb(v_allowed));
END
$function$;
