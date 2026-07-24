
ALTER TABLE public.client_intake_submissions
  ADD COLUMN IF NOT EXISTS ai_scribe_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_scribe_consent_at timestamptz;
