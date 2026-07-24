CREATE POLICY "Nurse practitioners view all appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'nurse_practitioner'));

CREATE POLICY "Nurse practitioners view appointment consents"
ON public.appointment_consents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'nurse_practitioner'));

GRANT SELECT ON public.appointments TO authenticated;
GRANT SELECT ON public.appointment_consents TO authenticated;