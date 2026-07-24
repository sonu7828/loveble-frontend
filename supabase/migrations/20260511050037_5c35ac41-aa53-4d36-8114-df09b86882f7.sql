CREATE OR REPLACE FUNCTION public.is_scheduler_or_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'scheduler')
      OR public.has_role(_user_id, 'receptionist')
$function$;