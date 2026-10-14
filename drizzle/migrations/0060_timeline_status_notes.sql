ALTER TABLE public.implementation_timeline_steps ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.implementation_timeline_steps ADD COLUMN IF NOT EXISTS notes text;
UPDATE public.implementation_timeline_steps SET status = 'concluido' WHERE done_at IS NOT NULL;
ALTER TABLE public.implementation_timeline_steps ADD CONSTRAINT implementation_timeline_steps_status_check CHECK (status IN ('pendente','parcial','concluido'));