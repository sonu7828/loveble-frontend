
-- 1. Add credit & unit-bank applied cents to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS credit_applied_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_bank_applied_cents integer NOT NULL DEFAULT 0;

-- 2. Per-service unit banks per client
CREATE TABLE IF NOT EXISTS public.client_unit_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  units numeric(10,2) NOT NULL,
  reason text NOT NULL,
  note text,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_unit_banks_email_idx
  ON public.client_unit_banks (lower(client_email));
CREATE INDEX IF NOT EXISTS client_unit_banks_service_idx
  ON public.client_unit_banks (service_id);
CREATE INDEX IF NOT EXISTS client_unit_banks_created_idx
  ON public.client_unit_banks (created_at DESC);

GRANT SELECT, INSERT ON public.client_unit_banks TO authenticated;
GRANT ALL ON public.client_unit_banks TO service_role;

ALTER TABLE public.client_unit_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own unit banks" ON public.client_unit_banks
  FOR SELECT TO authenticated
  USING (lower(client_email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

CREATE POLICY "Staff read all unit banks" ON public.client_unit_banks
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'staff')
    OR has_role(auth.uid(), 'scheduler')
    OR has_role(auth.uid(), 'receptionist')
  );

CREATE POLICY "Staff issue unit banks" ON public.client_unit_banks
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'staff')
    OR has_role(auth.uid(), 'scheduler')
    OR has_role(auth.uid(), 'receptionist')
  );

-- 3. Aggregated balance view
CREATE OR REPLACE VIEW public.client_unit_bank_balances AS
SELECT
  lower(b.client_email) AS client_email,
  b.service_id,
  s.name AS service_name,
  SUM(b.units)::numeric(12,2) AS balance,
  COUNT(*)::int AS entries,
  MAX(b.created_at) AS last_activity_at
FROM public.client_unit_banks b
LEFT JOIN public.services s ON s.id = b.service_id
GROUP BY lower(b.client_email), b.service_id, s.name;

GRANT SELECT ON public.client_unit_bank_balances TO authenticated;
GRANT ALL ON public.client_unit_bank_balances TO service_role;
