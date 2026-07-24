
CREATE TABLE IF NOT EXISTS public.consent_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  consent_form_id uuid,
  recipient_email text NOT NULL,
  template_name text NOT NULL,
  source text NOT NULL,
  idempotency_key text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  forms_count integer,
  reminder_number integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_email_log_appt ON public.consent_email_log (appointment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_email_log_recipient ON public.consent_email_log (lower(recipient_email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_email_log_created ON public.consent_email_log (created_at DESC);

ALTER TABLE public.consent_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedulers view consent email log"
  ON public.consent_email_log FOR SELECT TO authenticated
  USING (public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff view consent email log for own appts"
  ON public.consent_email_log FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.staff_profiles sp ON sp.id = a.staff_id
      WHERE a.id = consent_email_log.appointment_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients view own consent email log"
  ON public.consent_email_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = consent_email_log.appointment_id
        AND public.current_client_email() IS NOT NULL
        AND lower(a.client_email) = public.current_client_email()
    )
  );

CREATE POLICY "Service role inserts consent email log"
  ON public.consent_email_log FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');
