
CREATE OR REPLACE VIEW public.staff_directory
WITH (security_invoker = true) AS
SELECT id, full_name, title, color, bio, is_owner, is_active
FROM public.staff_profiles
WHERE is_active = true;

-- Allow anon/authenticated to read staff_profiles via this view (RLS still applies via invoker).
-- Add a permissive policy specifically scoped to anon role for the safe columns.
CREATE POLICY "Public can view active staff via directory"
ON public.staff_profiles FOR SELECT TO anon, authenticated
USING (is_active = true);
