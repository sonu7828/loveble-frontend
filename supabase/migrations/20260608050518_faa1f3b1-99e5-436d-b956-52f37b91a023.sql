CREATE TABLE IF NOT EXISTS public.perk_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  perk_kind text NOT NULL CHECK (perk_kind IN ('birthday','anniversary')),
  perk_year int NOT NULL,
  voucher_id uuid REFERENCES public.vouchers(id) ON DELETE SET NULL,
  amount_cents int NOT NULL,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_email, perk_kind, perk_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perk_grants TO authenticated;
GRANT ALL ON public.perk_grants TO service_role;

ALTER TABLE public.perk_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage perk grants" ON public.perk_grants
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Staff view perk grants" ON public.perk_grants
  FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_perk_grants_email ON public.perk_grants(lower(client_email));

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS perks_birthday_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perks_birthday_amount_cents int NOT NULL DEFAULT 2500,
  ADD COLUMN IF NOT EXISTS perks_birthday_validity_days int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS perks_anniversary_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perks_anniversary_amount_cents int NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS perks_anniversary_validity_days int NOT NULL DEFAULT 60;
