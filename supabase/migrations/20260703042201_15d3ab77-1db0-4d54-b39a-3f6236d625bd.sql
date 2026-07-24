
-- AI Scribe: session table + storage policies + purge cron
CREATE TABLE public.scribe_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_email text NOT NULL,
  provider_user_id uuid NOT NULL,
  audio_path text,
  audio_duration_sec integer,
  transcript text,
  generated_note jsonb,
  service_name text,
  category text,
  status text NOT NULL DEFAULT 'recording',
  consent_confirmed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  auto_delete_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scribe_sessions TO authenticated;
GRANT ALL ON public.scribe_sessions TO service_role;

ALTER TABLE public.scribe_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff read scribe sessions"
  ON public.scribe_sessions FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff create scribe sessions"
  ON public.scribe_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()) AND provider_user_id = auth.uid());

CREATE POLICY "Owner or admin update scribe sessions"
  ON public.scribe_sessions FOR UPDATE TO authenticated
  USING (provider_user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (provider_user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owner or admin delete scribe sessions"
  ON public.scribe_sessions FOR DELETE TO authenticated
  USING (provider_user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER touch_scribe_sessions
  BEFORE UPDATE ON public.scribe_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_scribe_sessions_appt ON public.scribe_sessions(appointment_id);
CREATE INDEX idx_scribe_sessions_client ON public.scribe_sessions(lower(client_email));
CREATE INDEX idx_scribe_sessions_purge ON public.scribe_sessions(auto_delete_at) WHERE audio_path IS NOT NULL;

-- Storage policies for scribe-audio bucket
CREATE POLICY "Clinical staff upload scribe audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scribe-audio' AND public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff read scribe audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'scribe-audio' AND public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff delete scribe audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'scribe-audio' AND (public.is_admin(auth.uid()) OR public.is_clinical_staff(auth.uid())));
