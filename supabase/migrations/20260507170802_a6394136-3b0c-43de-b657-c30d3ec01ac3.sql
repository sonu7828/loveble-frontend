
CREATE TABLE public.consent_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_universal BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active consent forms" ON public.consent_forms
  FOR SELECT USING (is_active);
CREATE POLICY "Admins manage consent forms" ON public.consent_forms
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER consent_forms_touch
  BEFORE UPDATE ON public.consent_forms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.bump_consent_version()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.body_markdown IS DISTINCT FROM OLD.body_markdown THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER consent_forms_bump_version
  BEFORE UPDATE ON public.consent_forms
  FOR EACH ROW EXECUTE FUNCTION public.bump_consent_version();

CREATE TABLE public.service_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consent_form_id UUID NOT NULL REFERENCES public.consent_forms(id) ON DELETE CASCADE,
  service_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (consent_form_id, service_id)
);
CREATE INDEX idx_service_consents_service ON public.service_consents(service_id);
ALTER TABLE public.service_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view service consents" ON public.service_consents
  FOR SELECT USING (true);
CREATE POLICY "Admins manage service consents" ON public.service_consents
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE public.consent_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL,
  consent_form_id UUID NOT NULL REFERENCES public.consent_forms(id),
  form_version INTEGER NOT NULL,
  client_email TEXT NOT NULL,
  signed_full_name TEXT NOT NULL,
  signature_png TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consent_sig_appt ON public.consent_signatures(appointment_id);
CREATE INDEX idx_consent_sig_lookup ON public.consent_signatures(client_email, consent_form_id, form_version);
ALTER TABLE public.consent_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedulers view all signatures" ON public.consent_signatures
  FOR SELECT TO authenticated USING (is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Staff view signatures for own appts" ON public.consent_signatures
  FOR SELECT TO authenticated USING (
    is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM appointments a JOIN staff_profiles sp ON sp.id = a.staff_id
      WHERE a.id = consent_signatures.appointment_id AND sp.user_id = auth.uid()
    )
  );
