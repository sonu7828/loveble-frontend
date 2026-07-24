
CREATE TABLE public.client_perks (
  client_email text PRIMARY KEY,
  is_healthcare_worker boolean NOT NULL DEFAULT false,
  is_friend boolean NOT NULL DEFAULT false,
  note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_perks TO authenticated;
GRANT ALL ON public.client_perks TO service_role;

ALTER TABLE public.client_perks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view client perks"
  ON public.client_perks FOR SELECT
  TO authenticated
  USING (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff can insert client perks"
  ON public.client_perks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff can update client perks"
  ON public.client_perks FOR UPDATE
  TO authenticated
  USING (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Admins can delete client perks"
  ON public.client_perks FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_client_perks_updated_at
  BEFORE UPDATE ON public.client_perks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
