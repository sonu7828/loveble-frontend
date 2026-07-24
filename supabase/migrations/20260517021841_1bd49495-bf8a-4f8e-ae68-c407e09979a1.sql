
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS consent_reminder_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS consent_max_reminders integer NOT NULL DEFAULT 3;

ALTER TABLE public.appointment_consents
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_appointment_consents_unsigned_reminder
  ON public.appointment_consents (appointment_id) WHERE signed = false;
