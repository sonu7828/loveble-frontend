
-- Restore full table grants for authenticated/service_role on staff_profiles.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_profiles TO authenticated;
GRANT ALL ON public.staff_profiles TO service_role;

-- Re-apply column-level grant for anon (safe directory fields only).
GRANT SELECT (id, full_name, title, color, bio, is_owner, is_active) ON public.staff_profiles TO anon;
