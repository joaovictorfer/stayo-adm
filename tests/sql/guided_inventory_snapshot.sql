-- Inventário guiado: snapshot do catálogo e isolamento entre implantações.
-- Roda tudo dentro de um bloco que termina com exceção controlada, então nada persiste.
DO $$
DECLARE
  v_admin uuid := (SELECT id FROM admin_profiles WHERE active AND role IN ('super_admin','admin') LIMIT 1);
  v_a uuid; v_b uuid; v_cat uuid; v_n int; v_name text;
BEGIN
  SELECT id INTO v_a FROM implementation_projects ORDER BY code LIMIT 1;
  SELECT id INTO v_b FROM implementation_projects ORDER BY code OFFSET 1 LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- 1. aplicar copia todos os itens ativos, com ambiente
  v_n := admin_apply_guide(v_a, 'inventario');
  IF v_n <> (SELECT count(*) FROM guide_catalog_items WHERE guide_type='inventario' AND active) THEN
    RAISE EXCEPTION 'FALHA snapshot: % itens', v_n; END IF;
  IF EXISTS (SELECT 1 FROM implementation_guide_items WHERE implementation_id=v_a AND guide_type='inventario' AND room IS NULL) THEN
    RAISE EXCEPTION 'FALHA: item sem ambiente'; END IF;

  -- 2. reaplicar é idempotente
  IF admin_apply_guide(v_a, 'inventario') <> 0 THEN RAISE EXCEPTION 'FALHA idempotência'; END IF;

  -- 3. mudar o modelo não altera o snapshot existente
  SELECT id INTO v_cat FROM guide_catalog_items WHERE guide_type='inventario' AND name='Forma de pizza';
  UPDATE guide_catalog_items SET name='Forma de pizza (modelo novo)' WHERE id=v_cat;
  SELECT name INTO v_name FROM implementation_guide_items WHERE implementation_id=v_a AND catalog_item_id=v_cat;
  IF v_name <> 'Forma de pizza' THEN RAISE EXCEPTION 'FALHA: modelo alterou snapshot'; END IF;

  -- 4. isolamento: aplicar em B recebe o modelo atual e editar A não afeta B
  PERFORM admin_apply_guide(v_b, 'inventario');
  UPDATE implementation_guide_items SET name='Forma de pizza pequena' WHERE implementation_id=v_a AND catalog_item_id=v_cat;
  SELECT name INTO v_name FROM implementation_guide_items WHERE implementation_id=v_b AND catalog_item_id=v_cat;
  IF v_name <> 'Forma de pizza (modelo novo)' THEN RAISE EXCEPTION 'FALHA isolamento: %', v_name; END IF;

  -- 5. não mistura com enxoval
  IF EXISTS (SELECT 1 FROM implementation_guide_items WHERE implementation_id IN (v_a,v_b) AND guide_type='enxoval' AND room IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHA: mistura com enxoval'; END IF;

  -- 6. sem papel administrativo, aplicar é negado
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM admin_apply_guide(v_a, 'inventario');
    RAISE EXCEPTION 'FALHA: aplicou sem permissão';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  RAISE EXCEPTION 'TODOS_OK';
END $$;
