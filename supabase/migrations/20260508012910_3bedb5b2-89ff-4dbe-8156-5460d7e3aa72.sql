
-- ============================================================
-- Security fixes: tighten RLS on tables exposed to anon, lock down storage
-- ============================================================

-- 1. appointment_consents: remove blanket public SELECT (edge fn uses service role)
DROP POLICY IF EXISTS "Public can view assignments via appointment token" ON public.appointment_consents;

-- 2. appointment_services: remove blanket public SELECT
DROP POLICY IF EXISTS "Public can view appointment services" ON public.appointment_services;

-- 3. schedule_overrides: drop public SELECT (only used by service-role get-availability + auth staff).
--    Add a public view exposing only safe columns for any future anon use, and a staff-wide SELECT policy.
DROP POLICY IF EXISTS "Public can view overrides" ON public.schedule_overrides;

CREATE POLICY "Staff and admins view all overrides"
ON public.schedule_overrides FOR SELECT TO authenticated
USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE OR REPLACE VIEW public.schedule_overrides_public
WITH (security_invoker = true) AS
SELECT id, staff_id, location_id, override_type, start_at, end_at
FROM public.schedule_overrides;

GRANT SELECT ON public.schedule_overrides_public TO anon, authenticated;

-- 4. staff_profiles: drop public SELECT (exposes email/user_id/google_calendar_token).
--    Add a public directory view with safe columns only; add staff-wide SELECT for authenticated staff.
DROP POLICY IF EXISTS "Public can view active staff (no tokens)" ON public.staff_profiles;

CREATE POLICY "Staff can view all staff profiles"
ON public.staff_profiles FOR SELECT TO authenticated
USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff can view own profile row"
ON public.staff_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE VIEW public.staff_directory
WITH (security_invoker = false) AS
SELECT id, full_name, title, color, bio, is_owner, is_active
FROM public.staff_profiles
WHERE is_active = true;

GRANT SELECT ON public.staff_directory TO anon, authenticated;

-- 5. Storage buckets: make consent-pdfs and calendar-invites private; add service-role-only write/read policies on objects
UPDATE storage.buckets SET public = false WHERE id IN ('consent-pdfs', 'calendar-invites');

-- Service-role-only policies (edge functions). RLS on storage.objects is already enabled.
DROP POLICY IF EXISTS "Service role manages consent pdfs" ON storage.objects;
CREATE POLICY "Service role manages consent pdfs" ON storage.objects FOR ALL TO public
USING (bucket_id = 'consent-pdfs' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'consent-pdfs' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages calendar invites" ON storage.objects;
CREATE POLICY "Service role manages calendar invites" ON storage.objects FOR ALL TO public
USING (bucket_id = 'calendar-invites' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'calendar-invites' AND auth.role() = 'service_role');
