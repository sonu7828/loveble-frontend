
-- Storage bucket for consent PDFs (public read, server-side write only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('consent-pdfs', 'consent-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Public read of files in this bucket
DROP POLICY IF EXISTS "Public can read consent pdfs" ON storage.objects;
CREATE POLICY "Public can read consent pdfs"
ON storage.objects FOR SELECT
USING (bucket_id = 'consent-pdfs');

-- Track the URL of the generated PDF on the appointment
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS consent_pdf_url text;
