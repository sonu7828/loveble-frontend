
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS checkin_sms_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkin_sms_template text,
  ADD COLUMN IF NOT EXISTS checkin_delay_hours integer NOT NULL DEFAULT 24
    CHECK (checkin_delay_hours IN (24, 48, 72));

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS checkin_sms_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_appointments_checkin_pending
  ON public.appointments (status, checkin_sms_sent_at, updated_at)
  WHERE status = 'completed' AND checkin_sms_sent_at IS NULL;
