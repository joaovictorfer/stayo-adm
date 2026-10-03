ALTER TABLE public.implementation_guide_items ADD COLUMN IF NOT EXISTS amenity_key text;
COMMENT ON COLUMN public.implementation_guide_items.amenity_key IS 'Chave estável do item vindo de Comodidades e itens do imóvel (sincronização idempotente).';
CREATE UNIQUE INDEX IF NOT EXISTS implementation_guide_items_amenity_key_uq ON public.implementation_guide_items (implementation_id, amenity_key);