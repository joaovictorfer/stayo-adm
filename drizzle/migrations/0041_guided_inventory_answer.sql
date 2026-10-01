-- Resposta rápida do inventário guiado. NULL = "Não informado". Não gera compra/pendência.
ALTER TABLE public.implementation_guide_items ADD COLUMN inventory_answer text;
ALTER TABLE public.implementation_guide_items ADD COLUMN inventory_answered_at timestamptz;
ALTER TABLE public.implementation_guide_items ADD COLUMN inventory_answered_by uuid;
ALTER TABLE public.implementation_guide_items ADD CONSTRAINT implementation_guide_items_inventory_answer_check
  CHECK (inventory_answer IS NULL OR (guide_type = 'inventario' AND inventory_answer IN ('tenho','nao_tenho','nao_aplica')));