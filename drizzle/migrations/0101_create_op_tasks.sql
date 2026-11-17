CREATE TABLE public.op_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  kind text NOT NULL DEFAULT 'limpeza' CHECK (kind IN ('limpeza','vistoria','manutencao','checkin','checkout','outro')),
  implementation_id uuid REFERENCES public.implementation_projects(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  scheduled_time time,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  amount numeric(12,2) CHECK (amount IS NULL OR amount >= 0),
  responsible_name text,
  guidance text,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX op_tasks_due_idx ON public.op_tasks(due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_tasks TO authenticated;
GRANT ALL ON public.op_tasks TO service_role;
ALTER TABLE public.op_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_tasks read" ON public.op_tasks FOR SELECT TO authenticated
  USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "op_tasks write" ON public.op_tasks FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','operations'));
CREATE OR REPLACE FUNCTION public.op_tasks_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status <> 'concluida') THEN NEW.completed_at := now();
  ELSIF NEW.status <> 'concluida' THEN NEW.completed_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER op_tasks_stamp BEFORE INSERT OR UPDATE ON public.op_tasks FOR EACH ROW EXECUTE FUNCTION public.op_tasks_stamp();