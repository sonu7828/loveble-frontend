CREATE OR REPLACE FUNCTION public.force_reschedule_appointment(
  p_appointment_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_scheduler_or_admin(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to override appointment conflicts';
  END IF;
  PERFORM set_config('app.allow_appt_overlap', 'on', true);
  UPDATE public.appointments
     SET start_at = p_start_at,
         end_at = p_end_at,
         location_id = COALESCE(p_location_id, location_id),
         staff_id = COALESCE(p_staff_id, staff_id),
         updated_at = now()
   WHERE id = p_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_reschedule_appointment(uuid, timestamptz, timestamptz, uuid, uuid) TO authenticated;