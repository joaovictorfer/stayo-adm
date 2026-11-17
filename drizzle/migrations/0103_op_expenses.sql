CREATE TABLE public.op_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT current_date,
  implementation_id uuid REFERENCES public.implementation_projects(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.op_staff(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.op_tasks(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'material' CHECK (category IN ('material','transporte','servico_extra','outro')),
  description text NOT NULL CHECK (length(trim(description)) > 0),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','pago','recusado')),
  receipt_path text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX op_expenses_date_idx ON public.op_expenses(expense_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_expenses TO authenticated;
GRANT ALL ON public.op_expenses TO service_role;
ALTER TABLE public.op_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_expenses read" ON public.op_expenses FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "op_expenses write" ON public.op_expenses FOR ALL TO authenticated USING (public.has_admin_role('super_admin','admin','operations','finance')) WITH CHECK (public.has_admin_role('super_admin','admin','operations','finance'));
CREATE OR REPLACE FUNCTION public.op_expenses_touch_fn() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER op_expenses_touch BEFORE UPDATE ON public.op_expenses FOR EACH ROW EXECUTE FUNCTION public.op_expenses_touch_fn();
CREATE POLICY "op task photos finance insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'op-task-photos' AND (storage.foldername(name))[1] = 'expenses' AND public.has_admin_role('finance'));