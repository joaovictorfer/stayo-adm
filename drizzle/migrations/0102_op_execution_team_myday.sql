CREATE TABLE public.op_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  phone text,
  active boolean NOT NULL DEFAULT true,
  source_provider_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.op_staff_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.op_staff(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '180 days',
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.op_task_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.op_tasks(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.op_staff(id) ON DELETE CASCADE,
  share numeric(5,2) NOT NULL DEFAULT 100 CHECK (share >= 0 AND share <= 100),
  is_lead boolean NOT NULL DEFAULT false,
  UNIQUE (task_id, staff_id)
);
CREATE TABLE public.op_task_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.op_tasks(id) ON DELETE CASCADE,
  area text,
  label text NOT NULL,
  requires_photo boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  checked_at timestamptz,
  checked_by text,
  photo_path text,
  note text
);
CREATE INDEX op_task_checklist_task_idx ON public.op_task_checklist(task_id, sort_order);
ALTER TABLE public.op_tasks ADD COLUMN checklist_template_id uuid REFERENCES public.op_checklist_templates(id) ON DELETE SET NULL;
ALTER TABLE public.op_tasks ADD COLUMN started_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_staff, public.op_task_team, public.op_task_checklist TO authenticated;
GRANT SELECT ON public.op_staff_links TO authenticated;
GRANT ALL ON public.op_staff, public.op_staff_links, public.op_task_team, public.op_task_checklist TO service_role;
ALTER TABLE public.op_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_staff_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_task_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_task_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_staff read" ON public.op_staff FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "op_staff write" ON public.op_staff FOR ALL TO authenticated USING (public.has_admin_role('super_admin','admin','operations')) WITH CHECK (public.has_admin_role('super_admin','admin','operations'));
CREATE POLICY "op_staff_links read" ON public.op_staff_links FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','operations'));
CREATE POLICY "op_task_team read" ON public.op_task_team FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "op_task_team write" ON public.op_task_team FOR ALL TO authenticated USING (public.has_admin_role('super_admin','admin','operations')) WITH CHECK (public.has_admin_role('super_admin','admin','operations'));
CREATE POLICY "op_task_checklist read" ON public.op_task_checklist FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "op_task_checklist write" ON public.op_task_checklist FOR ALL TO authenticated USING (public.has_admin_role('super_admin','admin','operations')) WITH CHECK (public.has_admin_role('super_admin','admin','operations'));

-- Conclusão só com checklist completo e fotos obrigatórias (vale para Admin e Meu Dia).
CREATE OR REPLACE FUNCTION public.op_tasks_guard_completion() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'em_andamento' AND NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status <> 'concluida') THEN
    IF EXISTS (SELECT 1 FROM public.op_task_checklist c WHERE c.task_id = NEW.id AND (c.checked_at IS NULL OR (c.requires_photo AND c.photo_path IS NULL))) THEN
      RAISE EXCEPTION 'checklist_incompleto' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER op_tasks_guard_completion BEFORE INSERT OR UPDATE ON public.op_tasks FOR EACH ROW EXECUTE FUNCTION public.op_tasks_guard_completion();

-- Link Meu Dia: token gerado no banco, só o hash é guardado; um link ativo por pessoa.
CREATE OR REPLACE FUNCTION public.admin_create_staff_link(p_staff_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_token text;
BEGIN
  IF NOT public.has_admin_role('super_admin','admin','operations') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.op_staff WHERE id = p_staff_id AND active) THEN RAISE EXCEPTION 'staff_inativo'; END IF;
  UPDATE public.op_staff_links SET revoked_at = now() WHERE staff_id = p_staff_id AND revoked_at IS NULL;
  v_token := 'md_' || encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.op_staff_links(staff_id, token_hash) VALUES (p_staff_id, encode(digest(v_token, 'sha256'), 'hex'));
  RETURN v_token;
END $$;
CREATE OR REPLACE FUNCTION public.admin_revoke_staff_links(p_staff_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_admin_role('super_admin','admin','operations') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.op_staff_links SET revoked_at = now() WHERE staff_id = p_staff_id AND revoked_at IS NULL;
END $$;
CREATE OR REPLACE FUNCTION public.op_staff_link_ctx(p_token text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT l.staff_id FROM public.op_staff_links l JOIN public.op_staff s ON s.id = l.staff_id
  WHERE l.token_hash = encode(digest(p_token, 'sha256'), 'hex') AND l.revoked_at IS NULL AND l.expires_at > now() AND s.active
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.admin_create_staff_link(uuid), public.admin_revoke_staff_links(uuid), public.op_staff_link_ctx(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_staff_link(uuid), public.admin_revoke_staff_links(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.op_staff_link_ctx(text) TO service_role;

-- Fotos do checklist: bucket privado; equipe Admin lê, administradores/operação enviam.
CREATE POLICY "op task photos read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'op-task-photos' AND public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'));
CREATE POLICY "op task photos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'op-task-photos' AND public.has_admin_role('super_admin','admin','operations'));