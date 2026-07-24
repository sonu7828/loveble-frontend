
-- 1) app_settings: replace overly-broad SELECT policy with staff/admin-only
DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.app_settings;

CREATE POLICY "Staff and admins read settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  public.is_staff_or_admin(auth.uid())
  OR public.is_scheduler_or_admin(auth.uid())
  OR public.is_clinical_staff(auth.uid())
);

-- 2) clinical-photos storage bucket: scope client reads to their own folder
DROP POLICY IF EXISTS "Clients view own clinical photos" ON storage.objects;

CREATE POLICY "Clients view own clinical photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'clinical-photos'
  AND public.current_client_email() IS NOT NULL
  AND lower((storage.foldername(name))[1]) = public.current_client_email()
);
