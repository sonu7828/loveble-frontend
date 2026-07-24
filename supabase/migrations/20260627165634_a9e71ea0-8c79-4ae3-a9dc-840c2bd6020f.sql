ALTER TABLE public.client_intake_submissions
  ADD COLUMN IF NOT EXISTS submission_kind text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS has_changes boolean,
  ADD COLUMN IF NOT EXISTS changes_meds text,
  ADD COLUMN IF NOT EXISTS changes_allergies text,
  ADD COLUMN IF NOT EXISTS changes_history text,
  ADD COLUMN IF NOT EXISTS changes_pregnancy text,
  ADD COLUMN IF NOT EXISTS recent_illness_or_event text,
  ADD COLUMN IF NOT EXISTS based_on_submission_id uuid REFERENCES public.client_intake_submissions(id) ON DELETE SET NULL;

ALTER TABLE public.client_intake_submissions
  DROP CONSTRAINT IF EXISTS client_intake_submissions_kind_check;
ALTER TABLE public.client_intake_submissions
  ADD CONSTRAINT client_intake_submissions_kind_check CHECK (submission_kind IN ('full','checkin'));

CREATE INDEX IF NOT EXISTS idx_client_intake_email_submitted
  ON public.client_intake_submissions (lower(client_email), submitted_at DESC);