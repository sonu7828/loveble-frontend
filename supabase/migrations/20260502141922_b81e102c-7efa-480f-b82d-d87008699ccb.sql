CREATE OR REPLACE FUNCTION public.get_my_staff_access()
RETURNS TABLE(
  roles public.app_role[],
  staff_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT ARRAY_AGG(DISTINCT role) FROM public.user_roles WHERE user_id = auth.uid()),
      ARRAY[]::public.app_role[]
    ) AS roles,
    (
      SELECT id
      FROM public.staff_profiles
      WHERE user_id = auth.uid()
      ORDER BY is_owner DESC, created_at ASC
      LIMIT 1
    ) AS staff_id
  WHERE auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_staff_access() TO authenticated;