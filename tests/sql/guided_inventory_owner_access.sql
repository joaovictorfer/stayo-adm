-- Executar: psql -v ON_ERROR_STOP=1 -f tests/sql/guided_inventory_owner_access.sql  (tudo é desfeito)
BEGIN;
CREATE TEMP TABLE r(t text, ok boolean) ON COMMIT DROP;
GRANT ALL ON r TO authenticated, anon;
DO $$
DECLARE a uuid; b uuid; aown uuid; adm uuid; impA uuid; impB uuid; item uuid; sid uuid; j jsonb; ok boolean;
BEGIN
  SELECT id, owner_id INTO a, aown FROM owner_portal_accounts ORDER BY created_at LIMIT 1;
  SELECT id INTO b FROM owner_portal_accounts WHERE id <> a LIMIT 1;
  SELECT id INTO adm FROM admin_profiles WHERE role='super_admin' AND active LIMIT 1;
  SELECT id INTO impA FROM implementation_projects WHERE code='IMP-00007';
  SELECT id INTO impB FROM implementation_projects WHERE code='IMP-00003';
  UPDATE implementation_projects SET owner_id = aown WHERE id = impA;  -- vínculo só de teste
  SELECT id INTO item FROM implementation_guide_items WHERE implementation_id=impA AND guide_type='inventario' AND name='Cama';
  PERFORM set_config('test.a', a::text, true); PERFORM set_config('test.b', b::text, true);
  PERFORM set_config('test.adm', adm::text, true); PERFORM set_config('test.impA', impA::text, true);
  PERFORM set_config('test.impB', impB::text, true); PERFORM set_config('test.item', item::text, true);
END $$;

-- Proprietário A no próprio imóvel
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('test.a'), 'role','authenticated')::text, true);
INSERT INTO r SELECT 'A lê o próprio inventário', jsonb_array_length(owner_inventory_resolve(current_setting('test.impA')::uuid)->'items') > 0;
INSERT INTO r SELECT 'A não vê nota interna', position('internal' in owner_inventory_resolve(current_setting('test.impA')::uuid)::text) = 0;
SELECT owner_inventory_submit(current_setting('test.impA')::uuid, current_setting('test.item')::uuid, '{"answer":"tenho","brand":"Ortobom","condition":"bom"}');
SELECT owner_inventory_submit(current_setting('test.impA')::uuid, NULL, '{"name":"Rede","room":"externa","answer":"tenho"}');
INSERT INTO r SELECT 'item não muda antes da revisão', (SELECT count(*) = 0 FROM implementation_guide_items WHERE id = current_setting('test.item')::uuid AND inventory_brand = 'Ortobom');
INSERT INTO r SELECT 'A não lê tabela de envios direto', (SELECT count(*) = 0 FROM implementation_inventory_submissions);
INSERT INTO r SELECT 'A não grava item direto', NOT EXISTS (SELECT 1 FROM implementation_guide_items WHERE id = current_setting('test.item')::uuid);
DO $$ BEGIN PERFORM owner_inventory_resolve(current_setting('test.impB')::uuid); INSERT INTO r VALUES ('A bloqueado no imóvel B', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('A bloqueado no imóvel B', true); END $$;
DO $$ BEGIN PERFORM owner_inventory_submit(current_setting('test.impB')::uuid, NULL, '{"name":"x","room":"sala"}'); INSERT INTO r VALUES ('A não envia para B', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('A não envia para B', true); END $$;
DO $$ BEGIN PERFORM admin_review_inventory_submission('{"decision":"aprovar"}'); INSERT INTO r VALUES ('A não revisa', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('A não revisa', true); END $$;

-- Proprietário B (sem vínculo com A)
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('test.b'), 'role','authenticated')::text, true);
DO $$ BEGIN PERFORM owner_inventory_resolve(current_setting('test.impA')::uuid); INSERT INTO r VALUES ('B bloqueado no imóvel A', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('B bloqueado no imóvel A', true); END $$;

-- Usuário logado sem vínculo nenhum
SELECT set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
DO $$ BEGIN PERFORM owner_inventory_resolve(current_setting('test.impA')::uuid); INSERT INTO r VALUES ('sem vínculo bloqueado', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('sem vínculo bloqueado', true); END $$;

-- Visitante sem login
RESET ROLE; SET LOCAL ROLE anon;
DO $$ BEGIN PERFORM owner_inventory_resolve(current_setting('test.impA')::uuid); INSERT INTO r VALUES ('anon bloqueado', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('anon bloqueado', true); END $$;

-- Admin revisa
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('test.adm'), 'role','authenticated')::text, true);
SELECT admin_review_inventory_submission(jsonb_build_object('submissionId', id, 'decision','ajustar',
  'values', '{"answer":"tenho","brand":"Ortobom","condition":"atencao"}'::jsonb, 'internalNote','colchão manchado'))
  FROM implementation_inventory_submissions WHERE item_id = current_setting('test.item')::uuid;
SELECT admin_review_inventory_submission(jsonb_build_object('submissionId', id, 'decision','complemento', 'ownerMessage','Envie o tamanho da rede'))
  FROM implementation_inventory_submissions WHERE kind='novo_item' AND implementation_id = current_setting('test.impA')::uuid;
INSERT INTO r SELECT 'ajuste aplicado e revisado', EXISTS (SELECT 1 FROM implementation_guide_items WHERE id = current_setting('test.item')::uuid
  AND inventory_condition='atencao' AND inventory_review_status='revisado_stayo');
INSERT INTO r SELECT 'trilha: anterior/proposto/autor/data', EXISTS (SELECT 1 FROM implementation_inventory_submissions WHERE item_id = current_setting('test.item')::uuid
  AND status='ajustado' AND previous IS NOT NULL AND proposed->>'condition'='bom' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_internal_note IS NOT NULL);
INSERT INTO r SELECT 'auditoria registrada', (SELECT count(*) >= 2 FROM audit_logs WHERE entity_type='implementation_inventory_submission' AND created_at >= now() - interval '1 minute');

-- Proprietário vê pedido de complemento, mas não a nota interna
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('test.a'), 'role','authenticated')::text, true);
INSERT INTO r SELECT 'A vê pedido de complemento', owner_inventory_resolve(current_setting('test.impA')::uuid)::text LIKE '%Envie o tamanho da rede%';
INSERT INTO r SELECT 'A não vê nota interna da decisão', owner_inventory_resolve(current_setting('test.impA')::uuid)::text NOT LIKE '%colchão manchado%';

RESET ROLE;
SELECT t, ok FROM r;
ROLLBACK;
