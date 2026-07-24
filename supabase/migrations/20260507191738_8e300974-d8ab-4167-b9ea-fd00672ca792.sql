REVOKE EXECUTE ON FUNCTION public.current_client_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_client_email() TO authenticated;