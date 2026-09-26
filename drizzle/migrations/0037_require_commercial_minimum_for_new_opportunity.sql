-- Nova oportunidade exige título, nome e telefone: a criação passa a usar só admin_create_opportunity.
REVOKE EXECUTE ON FUNCTION public.admin_create_draft_opportunity(jsonb) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.admin_create_draft_opportunity(jsonb) IS 'DEPRECATED: rascunho vazio desativado; use admin_create_opportunity (título, nome e telefone obrigatórios).';