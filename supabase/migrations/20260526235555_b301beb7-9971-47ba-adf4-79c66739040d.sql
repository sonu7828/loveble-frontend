
-- Helper functions
CREATE OR REPLACE FUNCTION public.is_nurse_practitioner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'nurse_practitioner') OR public.has_role(_user_id, 'admin') $$;

CREATE OR REPLACE FUNCTION public.is_clinical_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'staff')
      OR public.has_role(_user_id, 'scheduler')
      OR public.has_role(_user_id, 'nurse_practitioner')
$$;

REVOKE EXECUTE ON FUNCTION public.is_nurse_practitioner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_clinical_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_nurse_practitioner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_clinical_staff(uuid) TO authenticated, service_role;

-- =====================================================
-- GFE RECORDS
-- =====================================================
CREATE TABLE public.gfe_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  client_first_name text NOT NULL,
  client_last_name text NOT NULL,
  client_dob date,
  np_user_id uuid NOT NULL,
  np_staff_id uuid,
  np_name text NOT NULL,
  np_license text,

  chief_concerns text[] NOT NULL DEFAULT '{}',
  chief_concerns_notes text,
  treatment_goals text[] NOT NULL DEFAULT '{}',

  medical_history text[] NOT NULL DEFAULT '{}',
  medical_history_other text,
  current_medications text[] NOT NULL DEFAULT '{}',
  current_medications_other text,
  allergies text[] NOT NULL DEFAULT '{}',
  allergies_other text,

  prior_treatments text[] NOT NULL DEFAULT '{}',
  prior_treatments_last_date date,

  fitzpatrick text,
  skin_assessment text[] NOT NULL DEFAULT '{}',

  bp_systolic integer,
  bp_diastolic integer,
  heart_rate integer,
  height_in numeric,
  weight_lb numeric,

  pregnancy_status text,
  photo_consent boolean NOT NULL DEFAULT false,

  np_assessment_plan text NOT NULL,

  signed_at timestamptz NOT NULL DEFAULT now(),
  signature_png text,
  signed_ip text,
  signed_user_agent text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 months'),
  pdf_url text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gfe_records_client_email_idx ON public.gfe_records (lower(client_email), expires_at DESC);
CREATE INDEX gfe_records_np_idx ON public.gfe_records (np_user_id, signed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gfe_records TO authenticated;
GRANT ALL ON public.gfe_records TO service_role;
ALTER TABLE public.gfe_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff view all GFE" ON public.gfe_records FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));
CREATE POLICY "NPs create GFE" ON public.gfe_records FOR INSERT TO authenticated
  WITH CHECK (public.is_nurse_practitioner(auth.uid()) AND np_user_id = auth.uid());
CREATE POLICY "Admins update GFE" ON public.gfe_records FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete GFE" ON public.gfe_records FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Clients view own GFE" ON public.gfe_records FOR SELECT TO authenticated
  USING (public.current_client_email() IS NOT NULL AND lower(client_email) = public.current_client_email());

CREATE TRIGGER gfe_records_touch BEFORE UPDATE ON public.gfe_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- CLINICAL NOTES (header)
-- =====================================================
CREATE TYPE public.clinical_note_category AS ENUM ('neurotoxin','filler','energy','wellness');
CREATE TYPE public.clinical_note_status AS ENUM ('draft','signed','cosigned','locked');

CREATE TABLE public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid,
  client_email text NOT NULL,
  client_first_name text NOT NULL,
  client_last_name text NOT NULL,
  client_dob date,
  location_id uuid,
  provider_user_id uuid NOT NULL,
  provider_staff_id uuid,
  provider_name text NOT NULL,
  provider_role text,

  category public.clinical_note_category NOT NULL,
  service_name text,

  gfe_record_id uuid,
  consents_verified boolean NOT NULL DEFAULT false,
  photo_pre_url text,
  photo_post_url text,

  post_assessment text[] NOT NULL DEFAULT '{}',
  post_op_reviewed boolean NOT NULL DEFAULT false,
  followup_weeks integer,
  provider_notes text,

  status public.clinical_note_status NOT NULL DEFAULT 'draft',
  signed_at timestamptz,
  cosigned_at timestamptz,
  locked_at timestamptz,
  requires_cosign boolean NOT NULL DEFAULT false,
  pdf_url text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clinical_notes_client_idx ON public.clinical_notes (lower(client_email), created_at DESC);
CREATE INDEX clinical_notes_appt_idx ON public.clinical_notes (appointment_id);
CREATE INDEX clinical_notes_provider_idx ON public.clinical_notes (provider_user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_notes TO authenticated;
GRANT ALL ON public.clinical_notes TO service_role;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff view notes" ON public.clinical_notes FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clinical staff create notes" ON public.clinical_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()) AND provider_user_id = auth.uid());
CREATE POLICY "Clinical staff update notes" ON public.clinical_notes FOR UPDATE TO authenticated
  USING (public.is_clinical_staff(auth.uid())) WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Admins delete notes" ON public.clinical_notes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Clients view own notes" ON public.clinical_notes FOR SELECT TO authenticated
  USING (public.current_client_email() IS NOT NULL AND lower(client_email) = public.current_client_email() AND status IN ('signed','cosigned','locked'));

CREATE TRIGGER clinical_notes_touch BEFORE UPDATE ON public.clinical_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Lockout trigger: once signed/locked, only status/sign/lock/pdf_url fields can change
CREATE OR REPLACE FUNCTION public.protect_signed_clinical_note()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('cosigned','locked') THEN
    -- Allow only admin updates to PDF URL or status->locked
    IF NOT public.is_admin(auth.uid()) THEN
      IF NEW.status <> OLD.status OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
         OR NEW.cosigned_at IS DISTINCT FROM OLD.cosigned_at OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
         OR NEW.provider_notes IS DISTINCT FROM OLD.provider_notes
         OR NEW.post_assessment IS DISTINCT FROM OLD.post_assessment
         OR NEW.followup_weeks IS DISTINCT FROM OLD.followup_weeks
         OR NEW.client_email IS DISTINCT FROM OLD.client_email
         OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id THEN
        RAISE EXCEPTION 'Signed clinical notes are immutable. Use addendums.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER clinical_notes_protect_signed BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_clinical_note();

-- =====================================================
-- CATEGORY DETAIL TABLES
-- =====================================================
CREATE TABLE public.clinical_note_neurotoxin (
  clinical_note_id uuid PRIMARY KEY REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  product text NOT NULL,
  lot_number text NOT NULL,
  expiration_date date NOT NULL,
  dilution text,
  needle_gauge text,
  technique text[],
  injection_map jsonb NOT NULL DEFAULT '[]', -- [{zone, units}]
  total_units numeric NOT NULL DEFAULT 0,
  adverse_events text[] NOT NULL DEFAULT '{}',
  post_care_given boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_note_neurotoxin TO authenticated;
GRANT ALL ON public.clinical_note_neurotoxin TO service_role;
ALTER TABLE public.clinical_note_neurotoxin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage neurotoxin" ON public.clinical_note_neurotoxin FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid())) WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clients view own neurotoxin" ON public.clinical_note_neurotoxin FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinical_notes n WHERE n.id = clinical_note_id
    AND public.current_client_email() IS NOT NULL AND lower(n.client_email) = public.current_client_email()
    AND n.status IN ('signed','cosigned','locked')));

CREATE TABLE public.clinical_note_filler (
  clinical_note_id uuid PRIMARY KEY REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  product text NOT NULL,
  syringes_used numeric NOT NULL DEFAULT 0,
  lot_entries jsonb NOT NULL DEFAULT '[]', -- [{lot, exp}]
  areas text[] NOT NULL DEFAULT '{}',
  technique text[],
  delivery text, -- cannula/needle
  needle_gauge text,
  anesthetic text,
  hyaluronidase_onsite boolean NOT NULL DEFAULT false,
  vascular_protocol_reviewed boolean NOT NULL DEFAULT false,
  adverse_events text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_note_filler TO authenticated;
GRANT ALL ON public.clinical_note_filler TO service_role;
ALTER TABLE public.clinical_note_filler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage filler" ON public.clinical_note_filler FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid())) WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clients view own filler" ON public.clinical_note_filler FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinical_notes n WHERE n.id = clinical_note_id
    AND public.current_client_email() IS NOT NULL AND lower(n.client_email) = public.current_client_email()
    AND n.status IN ('signed','cosigned','locked')));

CREATE TABLE public.clinical_note_energy (
  clinical_note_id uuid PRIMARY KEY REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  device text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}', -- {energy, depth, pulse_width, passes_per_zone}
  areas text[] NOT NULL DEFAULT '{}',
  cooling_used boolean NOT NULL DEFAULT false,
  numbing_used boolean NOT NULL DEFAULT false,
  endpoint_achieved text[] NOT NULL DEFAULT '{}',
  adverse_events text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_note_energy TO authenticated;
GRANT ALL ON public.clinical_note_energy TO service_role;
ALTER TABLE public.clinical_note_energy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage energy" ON public.clinical_note_energy FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid())) WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clients view own energy" ON public.clinical_note_energy FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinical_notes n WHERE n.id = clinical_note_id
    AND public.current_client_email() IS NOT NULL AND lower(n.client_email) = public.current_client_email()
    AND n.status IN ('signed','cosigned','locked')));

CREATE TABLE public.clinical_note_wellness (
  clinical_note_id uuid PRIMARY KEY REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  product text,
  dose text,
  strength text,
  layers integer,
  route text, -- IM/SubQ/IV/topical
  lot_number text,
  expiration_date date,
  neutralization text,
  adverse_events text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_note_wellness TO authenticated;
GRANT ALL ON public.clinical_note_wellness TO service_role;
ALTER TABLE public.clinical_note_wellness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage wellness" ON public.clinical_note_wellness FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid())) WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clients view own wellness" ON public.clinical_note_wellness FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinical_notes n WHERE n.id = clinical_note_id
    AND public.current_client_email() IS NOT NULL AND lower(n.client_email) = public.current_client_email()
    AND n.status IN ('signed','cosigned','locked')));

-- =====================================================
-- SIGNATURES
-- =====================================================
CREATE TABLE public.clinical_note_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  signer_user_id uuid NOT NULL,
  signer_staff_id uuid,
  signer_name text NOT NULL,
  signer_role text NOT NULL, -- 'provider' | 'cosigner'
  signer_license text,
  signature_png text,
  ip_address text,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinical_note_signatures_note_idx ON public.clinical_note_signatures (clinical_note_id);
GRANT SELECT, INSERT ON public.clinical_note_signatures TO authenticated;
GRANT ALL ON public.clinical_note_signatures TO service_role;
ALTER TABLE public.clinical_note_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff view signatures" ON public.clinical_note_signatures FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clinical staff sign" ON public.clinical_note_signatures FOR INSERT TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()) AND signer_user_id = auth.uid());
CREATE POLICY "Clients view own signatures" ON public.clinical_note_signatures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinical_notes n WHERE n.id = clinical_note_id
    AND public.current_client_email() IS NOT NULL AND lower(n.client_email) = public.current_client_email()
    AND n.status IN ('signed','cosigned','locked')));

-- =====================================================
-- ADDENDUMS
-- =====================================================
CREATE TABLE public.clinical_note_addendums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  author_name text NOT NULL,
  author_role text,
  reason text NOT NULL,
  body text NOT NULL,
  signature_png text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinical_note_addendums_note_idx ON public.clinical_note_addendums (clinical_note_id, created_at);
GRANT SELECT, INSERT ON public.clinical_note_addendums TO authenticated;
GRANT ALL ON public.clinical_note_addendums TO service_role;
ALTER TABLE public.clinical_note_addendums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff view addendums" ON public.clinical_note_addendums FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clinical staff create addendums" ON public.clinical_note_addendums FOR INSERT TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()) AND author_user_id = auth.uid());
CREATE POLICY "Clients view own addendums" ON public.clinical_note_addendums FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinical_notes n WHERE n.id = clinical_note_id
    AND public.current_client_email() IS NOT NULL AND lower(n.client_email) = public.current_client_email()
    AND n.status IN ('signed','cosigned','locked')));

-- =====================================================
-- AUDIT LOG (HIPAA)
-- =====================================================
CREATE TABLE public.clinical_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_name text,
  resource_type text NOT NULL, -- 'gfe' | 'clinical_note'
  resource_id uuid NOT NULL,
  action text NOT NULL, -- 'view'|'create'|'update'|'sign'|'cosign'|'lock'|'download'|'addendum'
  metadata jsonb NOT NULL DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinical_audit_log_resource_idx ON public.clinical_audit_log (resource_type, resource_id, created_at DESC);
GRANT SELECT, INSERT ON public.clinical_audit_log TO authenticated;
GRANT ALL ON public.clinical_audit_log TO service_role;
ALTER TABLE public.clinical_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit" ON public.clinical_audit_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Clinical staff log audit" ON public.clinical_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()) AND actor_user_id = auth.uid());

-- =====================================================
-- STORAGE BUCKET for signed clinical PDFs
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('clinical-notes', 'clinical-notes', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clinical staff read clinical-notes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'clinical-notes' AND public.is_clinical_staff(auth.uid()));

CREATE POLICY "Service role manages clinical-notes"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'clinical-notes') WITH CHECK (bucket_id = 'clinical-notes');
