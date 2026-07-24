
-- Use column-level grants to hide sensitive columns from anon/authenticated.
-- The "Public can view active staff via directory" RLS policy still gates row visibility (is_active=true).
REVOKE SELECT ON public.staff_profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, title, color, bio, is_owner, is_active, created_at, updated_at)
  ON public.staff_profiles TO anon, authenticated;

-- Service role retains full access for edge functions.
GRANT ALL ON public.staff_profiles TO service_role;
