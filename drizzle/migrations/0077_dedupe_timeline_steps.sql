DELETE FROM public.implementation_timeline_steps t
USING (
  SELECT id, row_number() OVER (
    PARTITION BY implementation_id, lower(title)
    ORDER BY (status <> 'pendente' OR notes IS NOT NULL) DESC, position, id
  ) rn FROM public.implementation_timeline_steps
) d
WHERE t.id = d.id AND d.rn > 1;

WITH r AS (
  SELECT id, row_number() OVER (PARTITION BY implementation_id ORDER BY position, id) - 1 AS p
  FROM public.implementation_timeline_steps
)
UPDATE public.implementation_timeline_steps t SET position = r.p FROM r WHERE t.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS implementation_timeline_steps_unique_title
  ON public.implementation_timeline_steps (implementation_id, lower(title));