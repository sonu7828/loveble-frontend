
-- Settings singleton for the shared business calendar
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  shared_google_calendar_id text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO public.app_settings (id, shared_google_calendar_id) VALUES (1, 'primary')
  ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Track per-appointment consent assignments (so staff can send extra forms after booking)
CREATE TABLE IF NOT EXISTS public.appointment_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  consent_form_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_to_email text,
  signed boolean NOT NULL DEFAULT false,
  UNIQUE (appointment_id, consent_form_id)
);
ALTER TABLE public.appointment_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedulers manage all appointment consents"
  ON public.appointment_consents FOR ALL TO authenticated
  USING (is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff manage consents for own appts"
  ON public.appointment_consents FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM appointments a JOIN staff_profiles sp ON sp.id = a.staff_id
    WHERE a.id = appointment_consents.appointment_id AND sp.user_id = auth.uid()
  ))
  WITH CHECK (is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM appointments a JOIN staff_profiles sp ON sp.id = a.staff_id
    WHERE a.id = appointment_consents.appointment_id AND sp.user_id = auth.uid()
  ));

CREATE POLICY "Public can view assignments via appointment token"
  ON public.appointment_consents FOR SELECT TO public USING (true);

CREATE INDEX IF NOT EXISTS idx_appt_consents_appt ON public.appointment_consents(appointment_id);
