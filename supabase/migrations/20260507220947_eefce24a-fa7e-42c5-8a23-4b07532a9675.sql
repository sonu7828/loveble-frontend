
CREATE TABLE public.ghl_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  reminder_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, reminder_type)
);

ALTER TABLE public.ghl_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ghl reminder log"
ON public.ghl_reminder_log
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins view ghl reminder log"
ON public.ghl_reminder_log
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE INDEX idx_ghl_reminder_log_appt ON public.ghl_reminder_log(appointment_id);
