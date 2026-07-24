
-- Table for client-uploaded post-visit photos
CREATE TABLE IF NOT EXISTS public.client_uploaded_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_email text NOT NULL,
  storage_path text NOT NULL,
  caption text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cup_email ON public.client_uploaded_photos (lower(client_email));
CREATE INDEX IF NOT EXISTS idx_cup_appt ON public.client_uploaded_photos (appointment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_uploaded_photos TO authenticated;
GRANT ALL ON public.client_uploaded_photos TO service_role;

ALTER TABLE public.client_uploaded_photos ENABLE ROW LEVEL SECURITY;

-- Staff (any authenticated staff_profile) can view/update/delete
CREATE POLICY "Staff can view client uploaded photos"
  ON public.client_uploaded_photos FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.user_id = auth.uid()));

CREATE POLICY "Staff can update client uploaded photos"
  ON public.client_uploaded_photos FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.user_id = auth.uid()));

CREATE POLICY "Staff can delete client uploaded photos"
  ON public.client_uploaded_photos FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.user_id = auth.uid()));

-- Storage policies on the private bucket: staff can read/delete
CREATE POLICY "Staff can read client uploaded photos objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-uploaded-photos'
    AND EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.user_id = auth.uid())
  );

CREATE POLICY "Staff can delete client uploaded photos objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-uploaded-photos'
    AND EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.user_id = auth.uid())
  );
