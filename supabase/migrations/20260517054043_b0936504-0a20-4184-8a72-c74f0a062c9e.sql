-- 1. app_settings cadence + routing fields
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS consent_reminder_schedule integer[] NOT NULL DEFAULT '{72,48,24}',
  ADD COLUMN IF NOT EXISTS appointment_reminder_hours integer[] NOT NULL DEFAULT '{72,24}',
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS receptionist_email text;

UPDATE public.app_settings
   SET owner_email = COALESCE(owner_email, 'kv@rkaglow.com'),
       receptionist_email = COALESCE(receptionist_email, 'jonni@rkaglow.com')
 WHERE id = 1;

-- 2. staff_profiles personal calendar email
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS calendar_email text;

-- 3. Reclassify treatment-specific consents to annual (12 months validity)
UPDATE public.consent_forms
   SET consent_scope = 'annual'
 WHERE consent_scope = 'per_treatment';

-- 4. Backfill appointment_consents.signed where a valid signature already exists.
UPDATE public.appointment_consents ac
   SET signed = true
 WHERE ac.signed = false
   AND EXISTS (
     SELECT 1
       FROM public.appointments a
       JOIN public.consent_forms cf ON cf.id = ac.consent_form_id
       JOIN public.consent_signatures cs
         ON lower(cs.client_email) = lower(a.client_email)
        AND cs.consent_form_id = cf.id
        AND cs.form_version = cf.version
        AND cs.decision = 'consent'
        AND (cs.expires_at IS NULL OR cs.expires_at > now())
      WHERE a.id = ac.appointment_id
   );

-- 5. Attach sync_appointment_consent_signed trigger (idempotent)
DROP TRIGGER IF EXISTS trg_sync_appointment_consent_signed ON public.consent_signatures;
CREATE TRIGGER trg_sync_appointment_consent_signed
AFTER INSERT ON public.consent_signatures
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_consent_signed();

-- 6. Appointment reminder log
CREATE TABLE IF NOT EXISTS public.appointment_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  reminder_hours integer NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appt_reminder_unique
  ON public.appointment_reminder_log (appointment_id, reminder_hours, channel);
CREATE INDEX IF NOT EXISTS idx_appt_reminder_appt
  ON public.appointment_reminder_log (appointment_id);

ALTER TABLE public.appointment_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages appointment reminder log"
  ON public.appointment_reminder_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Schedulers view appointment reminder log"
  ON public.appointment_reminder_log
  FOR SELECT
  TO authenticated
  USING (is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff view appointment reminder log for own appts"
  ON public.appointment_reminder_log
  FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM appointments a
      JOIN staff_profiles sp ON sp.id = a.staff_id
      WHERE a.id = appointment_reminder_log.appointment_id
        AND sp.user_id = auth.uid()
    )
  );