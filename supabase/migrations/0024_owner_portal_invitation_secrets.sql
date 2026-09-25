-- Guarda o token do link de implantação do proprietário para que a equipe
-- possa copiar o mesmo link depois de atualizar a página. Só a equipe lê;
-- apagado automaticamente quando o convite é revogado ou usado.
CREATE TABLE IF NOT EXISTS public.owner_portal_invitation_secrets (
  invitation_id uuid PRIMARY KEY REFERENCES public.owner_portal_invitations(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.owner_portal_invitation_secrets TO authenticated;
GRANT ALL ON public.owner_portal_invitation_secrets TO service_role;
REVOKE ALL ON public.owner_portal_invitation_secrets FROM anon;

ALTER TABLE public.owner_portal_invitation_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipe lê token de convite ativo" ON public.owner_portal_invitation_secrets;
CREATE POLICY "equipe lê token de convite ativo"
  ON public.owner_portal_invitation_secrets FOR SELECT TO authenticated
  USING (
    public.has_admin_role('super_admin', 'admin', 'commercial', 'operations')
    AND EXISTS (
      SELECT 1 FROM public.owner_portal_invitations i
      WHERE i.id = invitation_id AND i.revoked_at IS NULL AND i.used_at IS NULL AND i.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "comercial/admin guardam token" ON public.owner_portal_invitation_secrets;
CREATE POLICY "comercial/admin guardam token"
  ON public.owner_portal_invitation_secrets FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role('super_admin', 'admin', 'commercial'));

CREATE OR REPLACE FUNCTION public.owner_portal_invitation_drop_secret()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL OR NEW.used_at IS NOT NULL THEN
    DELETE FROM public.owner_portal_invitation_secrets WHERE invitation_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.owner_portal_invitation_drop_secret() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS owner_portal_invitation_drop_secret ON public.owner_portal_invitations;
CREATE TRIGGER owner_portal_invitation_drop_secret
  AFTER UPDATE OF revoked_at, used_at ON public.owner_portal_invitations
  FOR EACH ROW EXECUTE FUNCTION public.owner_portal_invitation_drop_secret();