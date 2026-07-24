CREATE OR REPLACE FUNCTION public.update_appointment_end_force(p_appointment_id uuid, p_end_at timestamp with time zone, p_service_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_scheduler_or_admin(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to override appointment duration';
  END IF;
  PERFORM set_config('app.allow_appt_overlap', 'on', true);
  UPDATE public.appointments
     SET end_at = p_end_at, service_id = p_service_id, updated_at = now()
   WHERE id = p_appointment_id;
END $function$;