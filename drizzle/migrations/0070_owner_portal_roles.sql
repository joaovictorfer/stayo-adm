CREATE TYPE public.owner_portal_role AS ENUM ('titular', 'coproprietario', 'representante_legal');

ALTER TABLE public.owner_portal_accounts
  ADD COLUMN role public.owner_portal_role NOT NULL DEFAULT 'titular',
  ADD COLUMN share_percent numeric(5,2);

COMMENT ON COLUMN public.owner_portal_accounts.role IS 'Papel do acesso ao portal: titular, coproprietario (com cota) ou representante_legal (procurador). Definido pela equipe Stayo.';
COMMENT ON COLUMN public.owner_portal_accounts.share_percent IS 'Cota de participacao do coproprietario (0-100), apenas informativa.';