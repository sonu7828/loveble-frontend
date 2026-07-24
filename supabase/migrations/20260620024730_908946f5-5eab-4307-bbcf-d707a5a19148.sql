CREATE OR REPLACE FUNCTION public.get_incomplete_charts()
 RETURNS TABLE(appointment_id uuid, client_email text, client_first_name text, client_last_name text, start_at timestamp with time zone, end_at timestamp with time zone, status appointment_status, staff_id uuid, staff_name text, missing_note boolean, unsigned_consents bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH current_access AS (
    SELECT
      auth.uid() AS user_id,
      (
        public.is_scheduler_or_admin(auth.uid())
        OR public.has_role(auth.uid(), 'nurse_practitioner')
        OR public.has_role(auth.uid(), 'admin')
      ) AS can_see_all,
      (
        public.is_clinical_staff(auth.uid())
        OR public.is_scheduler_or_admin(auth.uid())
      ) AS can_open_queue
  ), any_notes AS (
    SELECT DISTINCT appointment_id FROM public.clinical_notes
  ), signed_notes AS (
    SELECT DISTINCT appointment_id
    FROM public.clinical_notes
    WHERE status IN ('signed', 'cosigned', 'locked')
  ), unsigned AS (
    SELECT appointment_id, count(*)::bigint AS unsigned_count
    FROM public.appointment_consents
    WHERE signed = false
    GROUP BY appointment_id
  )
  SELECT
    a.id AS appointment_id,
    a.client_email,
    a.client_first_name,
    a.client_last_name,
    a.start_at,
    a.end_at,
    a.status,
    a.staff_id,
    sp.full_name AS staff_name,
    (an.appointment_id IS NOT NULL AND sn.appointment_id IS NULL) AS missing_note,
    COALESCE(u.unsigned_count, 0)::bigint AS unsigned_consents
  FROM public.appointments a
  LEFT JOIN public.staff_profiles sp ON sp.id = a.staff_id
  LEFT JOIN any_notes an ON an.appointment_id = a.id
  LEFT JOIN signed_notes sn ON sn.appointment_id = a.id
  LEFT JOIN unsigned u ON u.appointment_id = a.id
  CROSS JOIN current_access access
  WHERE access.user_id IS NOT NULL
    AND access.can_open_queue
    AND a.start_at <= now()
    AND a.status IN ('completed', 'arrived', 'approved')
    AND (
      access.can_see_all
      OR EXISTS (
        SELECT 1
        FROM public.staff_profiles own_sp
        WHERE own_sp.id = a.staff_id
          AND own_sp.user_id = access.user_id
      )
    )
    AND (
      (an.appointment_id IS NOT NULL AND sn.appointment_id IS NULL)
      OR COALESCE(u.unsigned_count, 0) > 0
    )
  ORDER BY a.start_at DESC
  LIMIT 500;
$function$;