
CREATE TABLE public.preop_checklist_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  client_email text NOT NULL,
  item_key text NOT NULL,
  item_text text NOT NULL,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, item_key)
);
CREATE INDEX preop_progress_appt_idx ON public.preop_checklist_progress (appointment_id);
CREATE INDEX preop_progress_email_idx ON public.preop_checklist_progress (lower(client_email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preop_checklist_progress TO authenticated;
GRANT ALL ON public.preop_checklist_progress TO service_role;
ALTER TABLE public.preop_checklist_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients manage their own preop progress"
  ON public.preop_checklist_progress FOR ALL
  USING (lower(client_email) = public.current_client_email())
  WITH CHECK (lower(client_email) = public.current_client_email());
CREATE POLICY "Clinical staff view preop progress"
  ON public.preop_checklist_progress FOR SELECT
  USING (public.is_clinical_staff(auth.uid()));
CREATE TRIGGER trg_preop_progress_touch
  BEFORE UPDATE ON public.preop_checklist_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.postop_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  client_email text NOT NULL,
  day_offset int NOT NULL,
  swelling smallint CHECK (swelling IS NULL OR (swelling BETWEEN 1 AND 5)),
  bruising smallint CHECK (bruising IS NULL OR (bruising BETWEEN 1 AND 5)),
  pain smallint CHECK (pain IS NULL OR (pain BETWEEN 1 AND 5)),
  photo_path text,
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, day_offset)
);
CREATE INDEX postop_checkins_appt_idx ON public.postop_checkins (appointment_id);
CREATE INDEX postop_checkins_email_idx ON public.postop_checkins (lower(client_email), submitted_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.postop_checkins TO authenticated;
GRANT ALL ON public.postop_checkins TO service_role;
ALTER TABLE public.postop_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients manage their own postop checkins"
  ON public.postop_checkins FOR ALL
  USING (lower(client_email) = public.current_client_email())
  WITH CHECK (lower(client_email) = public.current_client_email());
CREATE POLICY "Clinical staff view postop checkins"
  ON public.postop_checkins FOR SELECT
  USING (public.is_clinical_staff(auth.uid()));
CREATE TRIGGER trg_postop_checkins_touch
  BEFORE UPDATE ON public.postop_checkins
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
