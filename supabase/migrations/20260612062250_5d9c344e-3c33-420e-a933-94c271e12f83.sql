DROP VIEW IF EXISTS public.staff_directory;
CREATE VIEW public.staff_directory AS
SELECT id, full_name, title, color, bio, is_active
FROM public.staff_profiles
WHERE is_active = true;
ALTER VIEW public.staff_directory SET (security_invoker = off);
GRANT SELECT ON public.staff_directory TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view active staff (directory)" ON public.staff_profiles;
REVOKE ALL ON public.staff_profiles FROM anon;
REVOKE SELECT ON public.staff_profiles FROM authenticated;
GRANT SELECT (id, user_id, full_name, title, email, bio, color, is_owner, is_active, created_at, updated_at, calendar_email, phone, checkin_sms_enabled, checkin_sms_template, checkin_delay_hours, license_number, review_sms_enabled, review_sms_template, review_sms_delay_hours, rebook_sms_enabled, rebook_sms_template, rebook_sms_weeks)
ON public.staff_profiles TO authenticated;

DROP POLICY IF EXISTS "Staff only can receive realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Staff only can send realtime messages" ON realtime.messages;
CREATE POLICY "Staff only can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff only can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));