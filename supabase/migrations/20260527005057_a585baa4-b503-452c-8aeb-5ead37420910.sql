
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz;

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_in_at timestamptz;

CREATE TABLE IF NOT EXISTS public.sms_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid,
  client_email text,
  phone text,
  template text NOT NULL,
  body text NOT NULL,
  ghl_message_id text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_send_log_appointment ON public.sms_send_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_sms_send_log_client_email ON public.sms_send_log(lower(client_email));

GRANT SELECT ON public.sms_send_log TO authenticated;
GRANT ALL ON public.sms_send_log TO service_role;

ALTER TABLE public.sms_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view sms send log"
  ON public.sms_send_log FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Clients view own sms send log"
  ON public.sms_send_log FOR SELECT TO authenticated
  USING (public.current_client_email() IS NOT NULL AND lower(client_email) = public.current_client_email());

CREATE POLICY "Service role manages sms send log"
  ON public.sms_send_log FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
