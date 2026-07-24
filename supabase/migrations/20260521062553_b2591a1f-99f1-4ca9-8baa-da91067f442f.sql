-- Create private bucket for client ID documents (driver's license, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-ids', 'client-ids', false)
ON CONFLICT (id) DO NOTHING;

-- Staff/admin only: full access to client-ids bucket
CREATE POLICY "Staff can view client IDs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-ids'
  AND (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()))
);

CREATE POLICY "Staff can upload client IDs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-ids'
  AND (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()))
);

CREATE POLICY "Staff can update client IDs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-ids'
  AND (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()))
);

CREATE POLICY "Staff can delete client IDs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-ids'
  AND (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()))
);