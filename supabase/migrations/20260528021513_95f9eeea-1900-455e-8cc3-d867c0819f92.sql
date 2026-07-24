
-- Re-add anon select policy on staff_profiles for active rows (column visibility controlled via GRANT below)
DROP POLICY IF EXISTS "Public can view active staff (directory)" ON public.staff_profiles;
CREATE POLICY "Public can view active staff (directory)"
  ON public.staff_profiles FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Drop the redundant authenticated-only policy added earlier
DROP POLICY IF EXISTS "Authenticated can view active staff (limited)" ON public.staff_profiles;

-- Column-level grants: restrict anon and authenticated to safe directory fields only.
-- Staff/admin retain full access through the "Staff can view all staff profiles" and "Admins manage staff profiles" policies,
-- which run against the same column grants — so we must keep enough columns granted to authenticated for staff usage.
-- Trick: anon gets only safe columns; authenticated keeps full table grant (RLS still gates which rows).
REVOKE SELECT ON public.staff_profiles FROM anon;
GRANT SELECT (id, full_name, title, color, bio, is_owner, is_active) ON public.staff_profiles TO anon;
