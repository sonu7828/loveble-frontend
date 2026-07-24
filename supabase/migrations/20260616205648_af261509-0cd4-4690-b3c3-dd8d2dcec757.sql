
CREATE TABLE public.photo_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  body_markdown_version int NOT NULL DEFAULT 1,
  signed_at timestamptz NOT NULL DEFAULT now(),
  signature_png text NOT NULL,
  signed_name text NOT NULL,
  witness_user_id uuid,
  witness_name text,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photo_consent_records_email_idx ON public.photo_consent_records (lower(client_email));
GRANT SELECT, INSERT, UPDATE ON public.photo_consent_records TO authenticated;
GRANT ALL ON public.photo_consent_records TO service_role;
ALTER TABLE public.photo_consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage photo consent"
  ON public.photo_consent_records FOR ALL
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clients read own photo consent"
  ON public.photo_consent_records FOR SELECT
  USING (lower(client_email) = public.current_client_email());

CREATE TABLE public.clinical_photo_meta (
  storage_path text PRIMARY KEY,
  clinical_note_id uuid,
  appointment_id uuid,
  client_email text NOT NULL,
  angle text NOT NULL DEFAULT 'front',
  region text,
  product text,
  kind text NOT NULL DEFAULT 'pre',
  exposure_iso text,
  framing_ref_path text,
  is_shared_with_patient boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinical_photo_meta_client_idx ON public.clinical_photo_meta (lower(client_email), created_at DESC);
CREATE INDEX clinical_photo_meta_note_idx ON public.clinical_photo_meta (clinical_note_id);
CREATE INDEX clinical_photo_meta_angle_idx ON public.clinical_photo_meta (lower(client_email), angle, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_photo_meta TO authenticated;
GRANT ALL ON public.clinical_photo_meta TO service_role;
ALTER TABLE public.clinical_photo_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage photo meta"
  ON public.clinical_photo_meta FOR ALL
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clients read own shared photo meta"
  ON public.clinical_photo_meta FOR SELECT
  USING (
    is_shared_with_patient = true
    AND lower(client_email) = public.current_client_email()
  );
