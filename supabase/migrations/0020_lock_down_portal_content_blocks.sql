-- Fase 2A / P0: fecha a tabela interna portal_content_blocks para acesso público.
--
-- Contexto auditado no Lovable Cloud em 2026-09-24:
-- - a tabela mistura draft_* e published_* na mesma linha;
-- - existia policy SELECT pública `qualquer visitante lê blocos do portal` USING (true);
-- - anon e authenticated possuíam privilégios amplos por default privileges;
-- - não existe consumidor público atual, view ou RPC dependente desta tabela;
-- - a contenção histórica equivalente em drizzle/0016 não foi usada como
--   autoridade desta aplicação; esta migration é a materialização canônica
--   incremental na linha supabase após 0017/0018/0019.
--
-- Não cria projeção pública. Uma futura exposição deverá nascer em migration
-- própria e retornar somente campos published_* estritamente necessários.

DO $$
BEGIN
  IF to_regclass('public.portal_content_blocks') IS NULL THEN
    RAISE EXCEPTION 'Fase 2A interrompida: public.portal_content_blocks não existe';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portal_content_blocks'
      AND column_name = 'draft_title'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portal_content_blocks'
      AND column_name = 'draft_body'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portal_content_blocks'
      AND column_name = 'published_title'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portal_content_blocks'
      AND column_name = 'published_body'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portal_content_blocks'
      AND column_name = 'published_at'
  ) THEN
    RAISE EXCEPTION 'Fase 2A interrompida: schema de portal_content_blocks divergiu do preflight';
  END IF;
END
$$;

ALTER TABLE public.portal_content_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qualquer visitante lê blocos do portal"
  ON public.portal_content_blocks;

DROP POLICY IF EXISTS "admin gerencia blocos do portal"
  ON public.portal_content_blocks;

CREATE POLICY "admin gerencia blocos do portal"
  ON public.portal_content_blocks
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    public.has_admin_role(
      VARIADIC ARRAY[
        'super_admin'::public.admin_role,
        'admin'::public.admin_role,
        'commercial'::public.admin_role
      ]
    ) IS TRUE
  )
  WITH CHECK (
    public.has_admin_role(
      VARIADIC ARRAY[
        'super_admin'::public.admin_role,
        'admin'::public.admin_role,
        'commercial'::public.admin_role
      ]
    ) IS TRUE
  );

-- A tabela base não é uma superfície pública. PUBLIC e anon ficam sem
-- privilégios, independentemente de default privileges globais do projeto.
REVOKE ALL PRIVILEGES
  ON TABLE public.portal_content_blocks
  FROM PUBLIC;

REVOKE ALL PRIVILEGES
  ON TABLE public.portal_content_blocks
  FROM anon;

-- Operadores internos usam a role authenticated e são filtrados pela policy
-- administrativa acima. Mantemos somente CRUD; TRUNCATE/REFERENCES/TRIGGER
-- não são necessários para a aplicação e não são protegidos como CRUD por RLS.
REVOKE ALL PRIVILEGES
  ON TABLE public.portal_content_blocks
  FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.portal_content_blocks
  TO authenticated;

-- Infraestrutura mantém somente CRUD explícito. Nenhum privilégio adicional
-- é necessário para a superfície auditada nesta fase.
REVOKE ALL PRIVILEGES
  ON TABLE public.portal_content_blocks
  FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.portal_content_blocks
  TO service_role;

-- sandbox_exec possui BYPASSRLS no Lovable Cloud e não é consumidor desta
-- tabela; remover seus grants evita um caminho interno indireto para drafts.
REVOKE ALL PRIVILEGES
  ON TABLE public.portal_content_blocks
  FROM sandbox_exec;
