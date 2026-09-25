ALTER TABLE public.implementation_timeline_updates DROP CONSTRAINT IF EXISTS implementation_timeline_updates_kind_check;
ALTER TABLE public.implementation_timeline_updates ADD CONSTRAINT implementation_timeline_updates_kind_check
  CHECK (kind = ANY (ARRAY['update','budget','stage','forecast','inspection','document','enxoval','cadastro']));