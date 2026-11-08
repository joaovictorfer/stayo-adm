CREATE TABLE public.payout_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel IN ('airbnb','booking','decolar','direta','outro')),
  payout_flow text NOT NULL DEFAULT 'stayo' CHECK (payout_flow IN ('platform_auto','stayo')),
  reservation_code text,
  guest_name text NOT NULL,
  guest_cpf text,
  checkin_date date NOT NULL,
  checkout_date date NOT NULL,
  gross_cents bigint NOT NULL DEFAULT 0 CHECK (gross_cents >= 0),
  cleaning_cents bigint NOT NULL DEFAULT 0 CHECK (cleaning_cents >= 0),
  platform_fee_cents bigint NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  owner_direct_cents bigint NOT NULL DEFAULT 0 CHECK (owner_direct_cents >= 0),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (checkout_date >= checkin_date)
);
CREATE INDEX payout_reservations_impl_idx ON public.payout_reservations(implementation_id, checkin_date);

CREATE TABLE public.property_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE RESTRICT,
  occurred_on date NOT NULL,
  category text NOT NULL DEFAULT 'manutencao' CHECK (category IN ('manutencao','lavanderia','compras','limpeza','taxas','outro')),
  description text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  charged_to_owner boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_expenses_impl_idx ON public.property_expenses(implementation_id, occurred_on);

CREATE TABLE public.payout_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.implementation_projects(id) ON DELETE RESTRICT,
  competence text NOT NULL CHECK (competence ~ '^\d{4}-\d{2}$'),
  paid_on date NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  method text NOT NULL DEFAULT 'pix',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payout_transfers_impl_idx ON public.payout_transfers(implementation_id, competence);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_reservations, public.property_expenses, public.payout_transfers TO authenticated;
GRANT ALL ON public.payout_reservations, public.property_expenses, public.payout_transfers TO service_role;

ALTER TABLE public.payout_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance admins manage payout reservations" ON public.payout_reservations FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','finance','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','finance','operations'));
CREATE POLICY "finance admins manage property expenses" ON public.property_expenses FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','finance','operations'))
  WITH CHECK (public.has_admin_role('super_admin','admin','finance','operations'));
CREATE POLICY "finance admins manage payout transfers" ON public.payout_transfers FOR ALL TO authenticated
  USING (public.has_admin_role('super_admin','admin','finance'))
  WITH CHECK (public.has_admin_role('super_admin','admin','finance'));