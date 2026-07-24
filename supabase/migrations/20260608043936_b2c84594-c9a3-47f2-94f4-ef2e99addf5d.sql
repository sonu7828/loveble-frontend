
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS review_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS rebook_sms_sent_at timestamptz;

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS review_sms_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS review_sms_template text,
  ADD COLUMN IF NOT EXISTS review_sms_delay_hours integer NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS rebook_sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rebook_sms_template text,
  ADD COLUMN IF NOT EXISTS rebook_sms_weeks integer NOT NULL DEFAULT 4;
