GRANT EXECUTE ON FUNCTION public.is_scheduler_or_admin(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin(uuid) TO authenticated, anon, service_role;