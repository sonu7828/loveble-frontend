
-- 1) Per-form policy
ALTER TABLE public.consent_forms
  ADD COLUMN IF NOT EXISTS consent_scope text NOT NULL DEFAULT 'annual'
    CHECK (consent_scope IN ('annual','per_treatment','perpetual')),
  ADD COLUMN IF NOT EXISTS validity_months integer;

-- 2) Default validity on app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS default_consent_validity_months integer NOT NULL DEFAULT 12;

-- 3) Signature expiry
ALTER TABLE public.consent_signatures
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 4) Backfill expires_at for existing annual signatures (12 months from signed_at)
UPDATE public.consent_signatures s
   SET expires_at = s.signed_at + INTERVAL '12 months'
  FROM public.consent_forms f
 WHERE s.consent_form_id = f.id
   AND s.expires_at IS NULL
   AND f.consent_scope = 'annual';

-- 5) Fast lookup for "latest valid signature for client + form"
CREATE INDEX IF NOT EXISTS idx_consent_sigs_email_form_valid
  ON public.consent_signatures (lower(client_email), consent_form_id, form_version, expires_at DESC, signed_at DESC);

-- 6) Audit log of consent validation decisions
CREATE TABLE IF NOT EXISTS public.consent_validation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  client_email text NOT NULL,
  required_form_ids uuid[] NOT NULL DEFAULT '{}',
  satisfied_form_ids uuid[] NOT NULL DEFAULT '{}',
  missing_form_ids uuid[] NOT NULL DEFAULT '{}',
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_validation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedulers view consent validation log"
  ON public.consent_validation_log FOR SELECT TO authenticated
  USING (public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff view validation log for own appts"
  ON public.consent_validation_log FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.staff_profiles sp ON sp.id = a.staff_id
      WHERE a.id = consent_validation_log.appointment_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role inserts validation log"
  ON public.consent_validation_log FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_consent_validation_appt
  ON public.consent_validation_log (appointment_id, created_at DESC);
