
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS intake_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS intake_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_day2_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_day14_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.client_intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_email text NOT NULL,
  allergies text[] NOT NULL DEFAULT '{}',
  allergies_other text,
  current_medications text[] NOT NULL DEFAULT '{}',
  current_medications_other text,
  medical_history text[] NOT NULL DEFAULT '{}',
  medical_history_other text,
  pregnancy_status text,
  concerns text,
  goals text,
  recent_treatments text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_intake_email
  ON public.client_intake_submissions (lower(client_email));

GRANT SELECT ON public.client_intake_submissions TO authenticated;
GRANT ALL ON public.client_intake_submissions TO service_role;

ALTER TABLE public.client_intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff can view intake submissions"
  ON public.client_intake_submissions FOR SELECT
  TO authenticated
  USING (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Admins can manage intake submissions"
  ON public.client_intake_submissions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_client_intake_touch
  BEFORE UPDATE ON public.client_intake_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
