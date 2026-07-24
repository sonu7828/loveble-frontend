-- Set search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin(uuid) TO authenticated;

-- Tighten audit log INSERT: only staff/admins can write, and only for appts they can see
DROP POLICY IF EXISTS "Authenticated can insert audit" ON public.appointment_audit_log;
CREATE POLICY "Staff/admin insert audit" ON public.appointment_audit_log
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.staff_profiles sp ON sp.id = a.staff_id
      WHERE a.id = appointment_id AND sp.user_id = auth.uid()
    )
  );