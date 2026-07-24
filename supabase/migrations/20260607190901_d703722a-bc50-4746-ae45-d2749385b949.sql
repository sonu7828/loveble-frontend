
-- 1. Extend client_credits with service-credit support
ALTER TABLE public.client_credits
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'dollar',
  ADD COLUMN IF NOT EXISTS service_id uuid NULL,
  ADD COLUMN IF NOT EXISTS service_label text NULL,
  ADD COLUMN IF NOT EXISTS units integer NULL,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS redeemed_sale_id uuid NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redeemed_amount_cents integer NULL;

ALTER TABLE public.client_credits
  DROP CONSTRAINT IF EXISTS client_credits_kind_chk;
ALTER TABLE public.client_credits
  ADD CONSTRAINT client_credits_kind_chk
  CHECK (kind IN ('dollar', 'service_free', 'service_value'));

-- Staff need UPDATE to mark redeemed
DROP POLICY IF EXISTS "Staff redeem credits" ON public.client_credits;
CREATE POLICY "Staff redeem credits" ON public.client_credits
  FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

GRANT UPDATE ON public.client_credits TO authenticated;

-- Index for fast "unredeemed service credits by email" lookup
CREATE INDEX IF NOT EXISTS client_credits_service_unredeemed_idx
  ON public.client_credits (lower(client_email))
  WHERE kind IN ('service_free','service_value') AND redeemed_at IS NULL;

-- 2. Update dollar balance view to ignore service credits
DROP VIEW IF EXISTS public.client_credit_balances;
CREATE VIEW public.client_credit_balances
WITH (security_invoker = true) AS
SELECT
  lower(client_email) AS client_email,
  COALESCE(sum(amount_cents) FILTER (WHERE kind = 'dollar'), 0)::integer AS balance_cents,
  count(*) FILTER (WHERE kind = 'dollar')::integer AS entries,
  max(created_at) FILTER (WHERE kind = 'dollar') AS last_activity_at
FROM public.client_credits
GROUP BY lower(client_email);

GRANT SELECT ON public.client_credit_balances TO authenticated;

-- 3. Helper view: each client's unredeemed service credits
DROP VIEW IF EXISTS public.client_service_credits_available;
CREATE VIEW public.client_service_credits_available
WITH (security_invoker = true) AS
SELECT
  id,
  lower(client_email) AS client_email,
  kind,
  service_id,
  service_label,
  units,
  amount_cents,
  reason,
  note,
  created_at
FROM public.client_credits
WHERE kind IN ('service_free','service_value')
  AND redeemed_at IS NULL;

GRANT SELECT ON public.client_service_credits_available TO authenticated;
