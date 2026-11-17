CREATE TABLE public.op_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text, task_type text NOT NULL,
  is_default boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.op_checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.op_checklist_templates(id) ON DELETE CASCADE,
  area text, label text NOT NULL, requires_photo boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.op_routine_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, routine_type text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('global','condominium','property')),
  scope_id uuid, active boolean NOT NULL DEFAULT true,
  default_priority text NOT NULL DEFAULT 'normal',
  default_requires_checklist boolean NOT NULL DEFAULT false,
  default_requires_inspection boolean NOT NULL DEFAULT false,
  default_requires_photo boolean NOT NULL DEFAULT false,
  default_total_amount numeric(12,2), default_orientation text,
  default_start_offset integer, default_deadline_offset integer,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_type = 'global') = (scope_id IS NULL)));
CREATE TABLE public.op_rule_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.op_routine_rules(id) ON DELETE CASCADE,
  source_provider_id uuid NOT NULL, provider_label text NOT NULL,
  role_in_routine text NOT NULL, is_lead boolean NOT NULL DEFAULT false,
  percentage numeric(5,2), fixed_amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_checklist_templates, public.op_checklist_template_items, public.op_routine_rules, public.op_rule_team TO authenticated;
GRANT ALL ON public.op_checklist_templates, public.op_checklist_template_items, public.op_routine_rules, public.op_rule_team TO service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['op_checklist_templates','op_checklist_template_items','op_routine_rules','op_rule_team'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "%s leitura equipe" ON public.%I FOR SELECT TO authenticated USING (public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer'))$p$, t, t);
    EXECUTE format($p$CREATE POLICY "%s escrita operacao" ON public.%I FOR ALL TO authenticated USING (public.has_admin_role('super_admin','admin','operations')) WITH CHECK (public.has_admin_role('super_admin','admin','operations'))$p$, t, t);
  END LOOP;
END $$;

INSERT INTO public.op_checklist_templates (id,name,description,task_type,is_default,is_active) VALUES
('2eaedf7a-83de-4dfd-a7c2-9c1c2fad7bcc','Manutenção corretiva','Checklist de manutenção sob demanda','maintenance',true,true),
('eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Vistoria completa do imóvel','Checklist padrão de vistoria por ambiente','inspection',true,true),
('ef310f02-9384-45fe-87c0-5826809ce95a','Limpeza padrão Stayo','Checklist padrão de limpeza pós check-out','cleaning',true,true);

INSERT INTO public.op_checklist_template_items (id,template_id,area,label,requires_photo,sort_order) VALUES
('10453300-6402-43d0-8bfd-e03f89944fb7','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Cozinha','Eletrodomésticos funcionando (fogão, geladeira, micro-ondas)',true,40),
('25b4fd8d-e779-4e88-9fb2-e7f70eaaaa3c','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Segurança','Sensores (fumaça, CO₂, porta) testados',true,70),
('2655e99e-9693-4798-ae0f-03b12f93fc47','ef310f02-9384-45fe-87c0-5826809ce95a','Cozinha','Repor esponja lacrada e tapete novo',true,70),
('3bca2dbc-5985-4f0b-9441-672e6b9fbe2d','2eaedf7a-83de-4dfd-a7c2-9c1c2fad7bcc','Diagnóstico','Foto do problema antes do reparo',true,10),
('47643612-f0cf-46a7-bb03-72c097047987','2eaedf7a-83de-4dfd-a7c2-9c1c2fad7bcc','Execução','Registrar materiais utilizados e custos',false,50),
('5749d44c-abd1-4cb5-8a8b-00a31fd088ca','ef310f02-9384-45fe-87c0-5826809ce95a','Banheiros','Repor toalhas (corpo, rosto e piscina conforme padrão)',false,40),
('65cae7f0-b1ea-4933-86e5-0fc7bc15347d','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Estrutura','Paredes, teto e piso sem danos',true,10),
('7229c18f-0890-49f4-9d96-4f0682127ef8','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Acesso','Fechadura/cadeado e Wi-Fi funcionando',false,80),
('77f50d29-ab5c-405b-acc8-fa5c3ca0f062','ef310f02-9384-45fe-87c0-5826809ce95a','Banheiros','Higienizar vaso, pia, box e espelho',false,30),
('816e4966-93bd-476c-93d6-fc4138e5c35a','ef310f02-9384-45fe-87c0-5826809ce95a','Final','Foto do quarto principal pronto',true,120),
('90522491-1788-4bd9-976f-3b41d1dd2802','ef310f02-9384-45fe-87c0-5826809ce95a','Quartos','Aspirar/varrer e passar pano no piso',false,20),
('90dd6a4d-86a0-456e-8f58-8eec63eebdf9','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Elétrica','Tomadas, interruptores e iluminação funcionando',false,20),
('af24063f-d6f4-4c00-b823-dc0e2b7327af','2eaedf7a-83de-4dfd-a7c2-9c1c2fad7bcc','Final','Testar funcionamento e confirmar resolução',false,60),
('afe2927f-a1f6-4866-aef0-8f4d3fa65ae9','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Hidráulica','Torneiras, descargas e ralos sem vazamento',false,30),
('b012027a-119d-4a22-be72-996fe25ec9e6','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Banheiros','Chuveiro, box, vaso e ventilação ok',true,50),
('b3386f1a-effd-420f-baee-3dea30e05ad1','ef310f02-9384-45fe-87c0-5826809ce95a','Sala','Aspirar sofá e tapetes, organizar almofadas',false,80),
('b9911f5d-e32d-49a8-87bf-4f55fea501c0','ef310f02-9384-45fe-87c0-5826809ce95a','Quartos','Trocar roupa de cama (lençol, fronha, edredom)',false,10),
('bb2ca588-f0fd-4f44-921e-9e92b03a7372','ef310f02-9384-45fe-87c0-5826809ce95a','Final','Conferir Wi-Fi, TV, ar-condicionado e fechaduras',false,100),
('c15c4f1a-0071-4037-bcb1-34877f08e0c5','2eaedf7a-83de-4dfd-a7c2-9c1c2fad7bcc','Execução','Realizar o reparo',false,30),
('cc2c7589-ff77-4b94-9055-1689c0e54f27','2eaedf7a-83de-4dfd-a7c2-9c1c2fad7bcc','Execução','Foto após o reparo concluído',true,40),
('ce22d11d-2330-430c-be00-51b6561a9985','ef310f02-9384-45fe-87c0-5826809ce95a','Áreas comuns','Limpar varanda/sacada e mobiliário externo',false,90),
('d3292157-ccd1-4da2-976e-552d5ad71940','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Final','Foto geral do imóvel',true,100),
('d474bb8d-e7ed-4e0c-938d-d56d3a39c61e','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Inventário','Conferir amenities, toalhas e itens da casa',false,90),
('d5047553-b3e4-49d0-92fb-99bdc0a086f8','2eaedf7a-83de-4dfd-a7c2-9c1c2fad7bcc','Diagnóstico','Descrever causa provável',false,20),
('dcf3b01c-eaf5-4164-badc-9ff2f33cd267','ef310f02-9384-45fe-87c0-5826809ce95a','Banheiros','Repor amenities (shampoo, sabonete, papel higiênico)',false,50),
('df6e171b-3c51-431d-8bbb-f99667dc2d0e','eadc17e7-eb5e-4fe3-ac03-c0d6a30ee000','Quartos','Camas, colchões e enxoval em bom estado',true,60),
('e72b76fe-29e9-4dea-ade6-d0943f4726a1','ef310f02-9384-45fe-87c0-5826809ce95a','Cozinha','Lavar louça, limpar fogão, micro-ondas e geladeira',false,60),
('f1fc65ce-307c-4e3b-953b-cf3a4792e759','ef310f02-9384-45fe-87c0-5826809ce95a','Final','Foto da sala pronta para chegada do hóspede',true,110);

INSERT INTO public.op_routine_rules (id,name,routine_type,scope_type,scope_id,active,default_priority,default_requires_checklist,default_requires_inspection,default_requires_photo,default_total_amount) VALUES
('5551c970-e1ea-4a24-9fcb-1ff78c71d2a5','Limpeza pré checkin','limpeza_pre_checkin','global',NULL,true,'normal',false,true,false,160);

INSERT INTO public.op_rule_team (id,rule_id,source_provider_id,provider_label,role_in_routine,is_lead,percentage,fixed_amount) VALUES
('49b554bb-1591-4c40-ab77-d7c92bc50741','5551c970-e1ea-4a24-9fcb-1ff78c71d2a5','83efcf16-a01d-41fb-8b3e-1dcb529291d6','Leandro Lima de Oliveira','limpeza',true,100,NULL);