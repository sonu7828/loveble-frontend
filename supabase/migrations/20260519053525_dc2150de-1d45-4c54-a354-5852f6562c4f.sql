
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS hero_image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read marketing assets" ON storage.objects;
CREATE POLICY "Public read marketing assets" ON storage.objects
FOR SELECT USING (bucket_id = 'marketing-assets');

DROP POLICY IF EXISTS "Staff upload marketing assets" ON storage.objects;
CREATE POLICY "Staff upload marketing assets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'marketing-assets'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'scheduler'::app_role))
);

DROP POLICY IF EXISTS "Staff update marketing assets" ON storage.objects;
CREATE POLICY "Staff update marketing assets" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'marketing-assets'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'scheduler'::app_role))
);

DROP POLICY IF EXISTS "Staff delete marketing assets" ON storage.objects;
CREATE POLICY "Staff delete marketing assets" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'marketing-assets'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'scheduler'::app_role))
);
