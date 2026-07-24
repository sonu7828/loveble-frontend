
CREATE TABLE IF NOT EXISTS public.appointment_staff_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, staff_id)
);

ALTER TABLE public.appointment_staff_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff/admin can view personal calendar event refs"
  ON public.appointment_staff_calendar_events FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Admin manages personal calendar event refs"
  ON public.appointment_staff_calendar_events FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_apse_appt ON public.appointment_staff_calendar_events(appointment_id);
CREATE INDEX IF NOT EXISTS idx_apse_staff ON public.appointment_staff_calendar_events(staff_id);
