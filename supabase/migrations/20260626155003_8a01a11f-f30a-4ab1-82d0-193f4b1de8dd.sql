
CREATE POLICY "Staff read own compliance pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'compliance-signatures'
    AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "Staff upload own compliance pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'compliance-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins manage compliance pdfs"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'compliance-signatures' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'compliance-signatures' AND public.is_admin(auth.uid()));

CREATE POLICY "Service role manages compliance pdfs"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'compliance-signatures')
  WITH CHECK (bucket_id = 'compliance-signatures');
