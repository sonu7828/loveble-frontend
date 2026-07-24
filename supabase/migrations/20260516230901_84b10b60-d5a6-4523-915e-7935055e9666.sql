ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS hourly_rate_cents integer,
  ADD COLUMN IF NOT EXISTS commission_percent numeric(5,2);