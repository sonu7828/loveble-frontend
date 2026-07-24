
-- 1. Restrict sensitive columns on staff_profiles from anon (email, google_calendar_token, user_id)
REVOKE SELECT ON public.staff_profiles FROM anon;
GRANT SELECT (id, full_name, title, bio, color, is_active, is_owner, created_at, updated_at) ON public.staff_profiles TO anon;

-- 2. Restrict schedule_overrides.reason from anon
REVOKE SELECT ON public.schedule_overrides FROM anon;
GRANT SELECT (id, staff_id, location_id, start_at, end_at, override_type, created_at) ON public.schedule_overrides TO anon;

-- 3. Lock down appointments INSERT — only service_role (edge function) may insert
DROP POLICY IF EXISTS "Anyone can create appointment" ON public.appointments;
REVOKE INSERT ON public.appointments FROM anon, authenticated;
