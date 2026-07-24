
-- Restore full column SELECT to authenticated (RLS still gates rows: own row, or staff/admin).
GRANT SELECT ON public.staff_profiles TO authenticated;

-- Anon role keeps only safe columns (RLS "Public can view active staff via directory" gates rows to is_active=true).
REVOKE SELECT ON public.staff_profiles FROM anon;
GRANT SELECT (id, full_name, title, color, bio, is_owner, is_active, created_at, updated_at)
  ON public.staff_profiles TO anon;
