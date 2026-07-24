
-- Add avatar columns
ALTER TABLE public.imported_clients ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS avatar_path text;

-- Storage policies for client-avatars bucket
-- File path convention: <client_email_lower>/<filename>
-- Staff can read/write all; clients can read/write their own folder.

CREATE POLICY "client-avatars staff all"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'client-avatars' AND public.is_clinical_staff(auth.uid()))
WITH CHECK (bucket_id = 'client-avatars' AND public.is_clinical_staff(auth.uid()));

CREATE POLICY "client-avatars owner read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-avatars'
  AND (storage.foldername(name))[1] = public.current_client_email()
);

CREATE POLICY "client-avatars owner write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-avatars'
  AND (storage.foldername(name))[1] = public.current_client_email()
);

CREATE POLICY "client-avatars owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-avatars'
  AND (storage.foldername(name))[1] = public.current_client_email()
);

CREATE POLICY "client-avatars owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-avatars'
  AND (storage.foldername(name))[1] = public.current_client_email()
);
