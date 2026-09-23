-- 1. Catálogo global de itens de enxoval (memoriza item + fornecedor)
CREATE TABLE public.supply_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  room text,
  supplier text,
  size text,
  unit_cost numeric(12,2),
  usage_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX supply_catalog_items_unique_key
  ON public.supply_catalog_items (
    lower(btrim(name)),
    lower(btrim(coalesce(room, ''))),
    lower(btrim(coalesce(supplier, '')))
  );

CREATE INDEX supply_catalog_items_name_idx ON public.supply_catalog_items (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_catalog_items TO authenticated;
GRANT ALL ON public.supply_catalog_items TO service_role;

ALTER TABLE public.supply_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time interno le catalogo de enxoval"
  ON public.supply_catalog_items FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));

CREATE POLICY "time interno gerencia catalogo de enxoval"
  ON public.supply_catalog_items FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations'));

CREATE TRIGGER supply_catalog_items_set_updated_at
  BEFORE UPDATE ON public.supply_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Novos campos da planilha de enxoval
ALTER TABLE public.implementation_supply_items
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS unit_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS procurement_stage text NOT NULL DEFAULT 'em_analise',
  ADD COLUMN IF NOT EXISTS payment_target text NOT NULL DEFAULT 'stayo',
  ADD COLUMN IF NOT EXISTS payee_name text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.implementation_supply_items
  ADD CONSTRAINT implementation_supply_items_procurement_stage_check
  CHECK (procurement_stage IN ('em_analise','proposta','fechamento','aguardando_servico','concluido'));

ALTER TABLE public.implementation_supply_items
  ADD CONSTRAINT implementation_supply_items_payment_target_check
  CHECK (payment_target IN ('stayo','terceiro'));

-- 3. Documentos (propostas, faturas, notas fiscais) por item
CREATE TABLE public.supply_item_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE CASCADE,
  supply_item_id uuid NOT NULL REFERENCES public.implementation_supply_items(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'outro',
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supply_item_documents_kind_check
    CHECK (kind IN ('proposta','fatura','nota_fiscal','contrato','outro'))
);

CREATE INDEX supply_item_documents_item_idx ON public.supply_item_documents (supply_item_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_item_documents TO authenticated;
GRANT ALL ON public.supply_item_documents TO service_role;

ALTER TABLE public.supply_item_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time interno le documentos de enxoval"
  ON public.supply_item_documents FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));

CREATE POLICY "time interno gerencia documentos de enxoval"
  ON public.supply_item_documents FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance'))
  WITH CHECK (public.has_admin_role('super_admin','admin','commercial','operations','finance'));

-- 4. Políticas de storage do bucket privado supply-documents
CREATE POLICY "time interno le documentos de compras"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supply-documents'
  AND public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer')
);

CREATE POLICY "time interno envia documentos de compras"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supply-documents'
  AND public.has_admin_role('super_admin','admin','commercial','operations','finance')
);

CREATE POLICY "time interno remove documentos de compras"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'supply-documents'
  AND public.has_admin_role('super_admin','admin','commercial','operations','finance')
);

-- 5. Catálogo alimentado automaticamente a cada item salvo
CREATE OR REPLACE FUNCTION public.supply_items_sync_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF btrim(coalesce(NEW.name, '')) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.supply_catalog_items (name, room, supplier, size, unit_cost)
  VALUES (
    btrim(NEW.name),
    nullif(btrim(coalesce(NEW.room, '')), ''),
    nullif(btrim(coalesce(NEW.supplier, '')), ''),
    nullif(btrim(coalesce(NEW.size, '')), ''),
    NEW.unit_cost
  )
  ON CONFLICT (
    lower(btrim(name)),
    lower(btrim(coalesce(room, ''))),
    lower(btrim(coalesce(supplier, '')))
  )
  DO UPDATE SET
    usage_count = public.supply_catalog_items.usage_count + 1,
    size = coalesce(EXCLUDED.size, public.supply_catalog_items.size),
    unit_cost = coalesce(EXCLUDED.unit_cost, public.supply_catalog_items.unit_cost),
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER implementation_supply_items_sync_catalog
  AFTER INSERT OR UPDATE OF name, room, supplier, size, unit_cost
  ON public.implementation_supply_items
  FOR EACH ROW EXECUTE FUNCTION public.supply_items_sync_catalog();

-- 6. Linha do tempo automática para compras de enxoval
CREATE OR REPLACE FUNCTION public.supply_items_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_label text;
  v_title text;
  v_description text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'Enxoval: ' || NEW.name || ' (' || coalesce(NEW.room, 'Geral') || ')';
    v_description := 'Item adicionado à planilha de enxoval. Quantidade: ' || NEW.required_qty ||
      coalesce(' · Fornecedor: ' || nullif(btrim(coalesce(NEW.supplier, '')), ''), '');
  ELSIF TG_OP = 'UPDATE' AND NEW.procurement_stage IS DISTINCT FROM OLD.procurement_stage THEN
    v_stage_label := CASE NEW.procurement_stage
      WHEN 'em_analise' THEN 'Em análise'
      WHEN 'proposta' THEN 'Proposta'
      WHEN 'fechamento' THEN 'Fechamento'
      WHEN 'aguardando_servico' THEN 'Aguardando serviço'
      WHEN 'concluido' THEN 'Concluído'
      ELSE NEW.procurement_stage
    END;
    v_title := 'Enxoval: ' || NEW.name || ' — ' || v_stage_label;
    v_description := coalesce('Fornecedor: ' || nullif(btrim(coalesce(NEW.supplier, '')), '') || '. ', '') ||
      'Ambiente: ' || coalesce(NEW.room, 'Geral') || '.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.implementation_timeline_updates
    (implementation_id, title, description, event_date, kind, owner_visible)
  VALUES (NEW.implementation_id, v_title, v_description, now(), 'enxoval', false);

  RETURN NEW;
END;
$$;

CREATE TRIGGER implementation_supply_items_timeline
  AFTER INSERT OR UPDATE OF procurement_stage
  ON public.implementation_supply_items
  FOR EACH ROW EXECUTE FUNCTION public.supply_items_timeline();

CREATE OR REPLACE FUNCTION public.supply_documents_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item text;
BEGIN
  SELECT name INTO v_item FROM public.implementation_supply_items WHERE id = NEW.supply_item_id;

  INSERT INTO public.implementation_timeline_updates
    (implementation_id, title, description, event_date, kind, owner_visible)
  VALUES (
    NEW.implementation_id,
    'Documento anexado: ' || NEW.filename,
    'Tipo: ' || NEW.kind || coalesce(' · Item: ' || v_item, ''),
    now(),
    'enxoval',
    false
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER supply_item_documents_timeline
  AFTER INSERT ON public.supply_item_documents
  FOR EACH ROW EXECUTE FUNCTION public.supply_documents_timeline();