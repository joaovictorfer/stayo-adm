-- Detalhes opcionais e duplicação do inventário guiado. Nada obrigatório além do nome.
ALTER TABLE public.implementation_guide_items
  ADD COLUMN inventory_quantity integer CHECK (inventory_quantity IS NULL OR inventory_quantity >= 0),
  ADD COLUMN inventory_brand text CHECK (inventory_brand IS NULL OR char_length(inventory_brand) <= 80),
  ADD COLUMN inventory_condition text CHECK (inventory_condition IS NULL OR inventory_condition IN ('bom','atencao','danificado')),
  ADD COLUMN inventory_internal_notes text CHECK (inventory_internal_notes IS NULL OR char_length(inventory_internal_notes) <= 1000),
  ADD COLUMN base_catalog_item_id uuid REFERENCES public.guide_catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN inventory_source text NOT NULL DEFAULT 'equipe' CHECK (inventory_source IN ('equipe','proprietario')),
  ADD COLUMN inventory_review_status text NOT NULL DEFAULT 'aprovado' CHECK (inventory_review_status IN ('aprovado','em_revisao')),
  ADD COLUMN inventory_updated_at timestamptz,
  ADD COLUMN inventory_updated_by uuid;

COMMENT ON COLUMN public.implementation_guide_items.inventory_internal_notes IS 'Interna da STAYO; nunca expor ao proprietário.';
COMMENT ON COLUMN public.implementation_guide_items.base_catalog_item_id IS 'Item-base de uma cópia duplicada; a cópia é independente (catalog_item_id NULL).';

-- Autor e data/hora de toda mudança em itens de inventário.
CREATE OR REPLACE FUNCTION public.guided_inventory_stamp()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.guide_type = 'inventario' THEN
    NEW.inventory_updated_at := now();
    NEW.inventory_updated_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER implementation_guide_items_inventory_stamp
  BEFORE INSERT OR UPDATE ON public.implementation_guide_items
  FOR EACH ROW EXECUTE FUNCTION public.guided_inventory_stamp();