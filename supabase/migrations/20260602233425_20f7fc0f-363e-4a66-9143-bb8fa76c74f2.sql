DROP POLICY IF EXISTS "Admins and NPs can read clinical protocol PDFs" ON storage.objects;
CREATE POLICY "Admins and NPs can read clinical protocol PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'clinical-protocols' AND (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Service role manages clinical protocol PDFs" ON storage.objects;
CREATE POLICY "Service role manages clinical protocol PDFs"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'clinical-protocols')
WITH CHECK (bucket_id = 'clinical-protocols');