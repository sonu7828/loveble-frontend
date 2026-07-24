ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS is_lead boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS lead_captured_at timestamptz;

CREATE INDEX IF NOT EXISTS client_profiles_is_lead_idx ON public.client_profiles(is_lead) WHERE is_lead = true;