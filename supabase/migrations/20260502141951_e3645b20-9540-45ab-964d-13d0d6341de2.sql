REVOKE ALL ON FUNCTION public.get_my_staff_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_staff_access() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_staff_access() TO authenticated;