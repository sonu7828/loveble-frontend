
CREATE TABLE public.appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  service_id uuid NOT NULL,
  duration_minutes integer NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointment_services_appointment ON public.appointment_services(appointment_id);

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view appointment services"
  ON public.appointment_services FOR SELECT
  USING (true);

CREATE POLICY "Schedulers manage appointment services"
  ON public.appointment_services FOR ALL
  TO authenticated
  USING (is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff manage services for own appts"
  ON public.appointment_services FOR ALL
  TO authenticated
  USING (
    is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM appointments a
      JOIN staff_profiles sp ON sp.id = a.staff_id
      WHERE a.id = appointment_services.appointment_id
        AND sp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM appointments a
      JOIN staff_profiles sp ON sp.id = a.staff_id
      WHERE a.id = appointment_services.appointment_id
        AND sp.user_id = auth.uid()
    )
  );
