ALTER TABLE public.appointment_consents
  ADD CONSTRAINT appointment_consents_consent_form_id_fkey
  FOREIGN KEY (consent_form_id) REFERENCES public.consent_forms(id) ON DELETE CASCADE;

ALTER TABLE public.appointment_consents
  ADD CONSTRAINT appointment_consents_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_appointment_consents_consent_form_id ON public.appointment_consents(consent_form_id);
CREATE INDEX IF NOT EXISTS idx_appointment_consents_appointment_id ON public.appointment_consents(appointment_id);