ALTER TABLE public.implementation_projects DROP CONSTRAINT implementation_projects_operational_status_check;
ALTER TABLE public.implementation_projects ADD CONSTRAINT implementation_projects_operational_status_check CHECK (operational_status IN ('operacao','implantacao','nao_classificado'));
ALTER TABLE public.implementation_projects ALTER COLUMN operational_status SET DEFAULT 'nao_classificado';