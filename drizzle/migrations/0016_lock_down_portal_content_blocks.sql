-- Fase A / P0: impede leitura pública direta da tabela base de conteúdo do portal.
--
-- Contexto confirmado no Lovable Cloud em 2026-09-24:
-- - `portal_content_blocks` mantém draft_* e published_* na mesma linha;
-- - havia policy SELECT `qualquer visitante lê blocos do portal` USING (true);
-- - o papel `anon` possuía SELECT direto na tabela;
-- - a tabela estava vazia no momento da auditoria;
-- - nenhum consumidor atual foi localizado em styo-adm/STAYO.APP.
--
-- Mesmo filtrando por `published_at`, SELECT direto continuaria expondo as
-- colunas draft_* de uma linha publicada. A contenção correta nesta fase é
-- remover acesso direto da identidade anônima à tabela base. Uma projeção
-- pública explícita (view/RPC somente com published_*) poderá ser criada na
-- fase de integração com o Guia, quando houver contrato de consumo definido.

DROP POLICY IF EXISTS "qualquer visitante lê blocos do portal"
  ON public.portal_content_blocks;

REVOKE ALL PRIVILEGES
  ON TABLE public.portal_content_blocks
  FROM anon;

-- O time interno continua acessando a tabela como `authenticated`, sujeito
-- às policies administrativas existentes. `service_role` não é alterado.
