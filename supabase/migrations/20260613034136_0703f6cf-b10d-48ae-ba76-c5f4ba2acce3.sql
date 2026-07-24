CREATE OR REPLACE FUNCTION public.can_manage_appointment_emails(_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.is_scheduler_or_admin(auth.uid())
      OR public.is_staff_or_admin(auth.uid())
      OR public.has_role(auth.uid(), 'nurse_practitioner')
    )
    AND (
      public.is_scheduler_or_admin(auth.uid())
      OR public.has_role(auth.uid(), 'nurse_practitioner')
      OR EXISTS (
        SELECT 1
        FROM public.appointments a
        JOIN public.staff_profiles sp ON sp.id = a.staff_id
        WHERE a.id = _appointment_id
          AND sp.user_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_appointment_emails(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_appointment_emails(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_appointment_emails(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_appointment_emails(uuid) TO service_role;