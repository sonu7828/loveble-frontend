DO $$
BEGIN
  CREATE TYPE public.clinical_protocol_category AS ENUM ('glp1', 'retatrutide', 'peptide', 'hrt', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.clinical_protocol_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.clinical_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category public.clinical_protocol_category NOT NULL DEFAULT 'other',
  current_version_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_protocols TO authenticated;
GRANT ALL ON public.clinical_protocols TO service_role;

ALTER TABLE public.clinical_protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and NPs can view protocols" ON public.clinical_protocols;
CREATE POLICY "Admins and NPs can view protocols"
ON public.clinical_protocols
FOR SELECT
TO authenticated
USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins and NPs can create protocols" ON public.clinical_protocols;
CREATE POLICY "Admins and NPs can create protocols"
ON public.clinical_protocols
FOR INSERT
TO authenticated
WITH CHECK ((public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid())) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admins and NPs can update protocols" ON public.clinical_protocols;
CREATE POLICY "Admins and NPs can update protocols"
ON public.clinical_protocols
FOR UPDATE
TO authenticated
USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.clinical_protocol_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES public.clinical_protocols(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  status public.clinical_protocol_status NOT NULL DEFAULT 'draft',
  indication text,
  regulatory_basis text,
  contraindications jsonb NOT NULL DEFAULT '{"absolute": [], "relative": []}'::jsonb,
  baseline_labs text[] NOT NULL DEFAULT '{}',
  followup_labs text[] NOT NULL DEFAULT '{}',
  titration jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_dose text,
  hold_criteria text,
  taper_rules text,
  monitoring text[] NOT NULL DEFAULT '{}',
  red_flags text[] NOT NULL DEFAULT '{}',
  counseling text[] NOT NULL DEFAULT '{}',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  necessity_template text,
  patient_handout_md text,
  signed_by_user_id uuid,
  signed_by_name text,
  signed_by_license text,
  signature_png text,
  signed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_protocol_versions_unique_version UNIQUE (protocol_id, version_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_protocol_versions TO authenticated;
GRANT ALL ON public.clinical_protocol_versions TO service_role;

ALTER TABLE public.clinical_protocol_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and NPs can view protocol versions" ON public.clinical_protocol_versions;
CREATE POLICY "Admins and NPs can view protocol versions"
ON public.clinical_protocol_versions
FOR SELECT
TO authenticated
USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins and NPs can create protocol versions" ON public.clinical_protocol_versions;
CREATE POLICY "Admins and NPs can create protocol versions"
ON public.clinical_protocol_versions
FOR INSERT
TO authenticated
WITH CHECK ((public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid())) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admins and NPs can update draft protocol versions" ON public.clinical_protocol_versions;
CREATE POLICY "Admins and NPs can update draft protocol versions"
ON public.clinical_protocol_versions
FOR UPDATE
TO authenticated
USING ((public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid())) AND status = 'draft')
WITH CHECK (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.clinical_protocol_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_version_id uuid NOT NULL REFERENCES public.clinical_protocol_versions(id),
  client_email text NOT NULL,
  client_first_name text,
  client_last_name text,
  client_dob date,
  appointment_id uuid,
  starting_week integer NOT NULL DEFAULT 1,
  prescriber_notes text,
  clinical_pdf_url text,
  handout_pdf_url text,
  applied_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_protocol_applications TO authenticated;
GRANT ALL ON public.clinical_protocol_applications TO service_role;

ALTER TABLE public.clinical_protocol_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and NPs can view protocol applications" ON public.clinical_protocol_applications;
CREATE POLICY "Admins and NPs can view protocol applications"
ON public.clinical_protocol_applications
FOR SELECT
TO authenticated
USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins and NPs can apply protocols" ON public.clinical_protocol_applications;
CREATE POLICY "Admins and NPs can apply protocols"
ON public.clinical_protocol_applications
FOR INSERT
TO authenticated
WITH CHECK ((public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid())) AND applied_by = auth.uid());

DROP POLICY IF EXISTS "Admins and NPs can update protocol application PDFs" ON public.clinical_protocol_applications;
CREATE POLICY "Admins and NPs can update protocol application PDFs"
ON public.clinical_protocol_applications
FOR UPDATE
TO authenticated
USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));

DO $$
BEGIN
  ALTER TABLE public.clinical_protocols
    ADD CONSTRAINT clinical_protocols_current_version_fk
    FOREIGN KEY (current_version_id) REFERENCES public.clinical_protocol_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinical_protocols_category_title ON public.clinical_protocols(category, title);
CREATE INDEX IF NOT EXISTS idx_clinical_protocol_versions_protocol ON public.clinical_protocol_versions(protocol_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_protocol_applications_client ON public.clinical_protocol_applications(lower(client_email), created_at DESC);

CREATE OR REPLACE FUNCTION public.protect_published_clinical_protocol_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'published' AND NOT public.is_admin(auth.uid()) THEN
    IF NEW.indication IS DISTINCT FROM OLD.indication
       OR NEW.regulatory_basis IS DISTINCT FROM OLD.regulatory_basis
       OR NEW.contraindications IS DISTINCT FROM OLD.contraindications
       OR NEW.baseline_labs IS DISTINCT FROM OLD.baseline_labs
       OR NEW.followup_labs IS DISTINCT FROM OLD.followup_labs
       OR NEW.titration IS DISTINCT FROM OLD.titration
       OR NEW.max_dose IS DISTINCT FROM OLD.max_dose
       OR NEW.hold_criteria IS DISTINCT FROM OLD.hold_criteria
       OR NEW.taper_rules IS DISTINCT FROM OLD.taper_rules
       OR NEW.monitoring IS DISTINCT FROM OLD.monitoring
       OR NEW.red_flags IS DISTINCT FROM OLD.red_flags
       OR NEW.counseling IS DISTINCT FROM OLD.counseling
       OR NEW.evidence IS DISTINCT FROM OLD.evidence
       OR NEW.necessity_template IS DISTINCT FROM OLD.necessity_template
       OR NEW.patient_handout_md IS DISTINCT FROM OLD.patient_handout_md
       OR NEW.signed_by_user_id IS DISTINCT FROM OLD.signed_by_user_id
       OR NEW.signed_by_name IS DISTINCT FROM OLD.signed_by_name
       OR NEW.signed_by_license IS DISTINCT FROM OLD.signed_by_license
       OR NEW.signature_png IS DISTINCT FROM OLD.signature_png
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at THEN
      RAISE EXCEPTION 'Published clinical protocol versions are immutable. Create a new draft.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_published_clinical_protocol_version ON public.clinical_protocol_versions;
CREATE TRIGGER protect_published_clinical_protocol_version
BEFORE UPDATE ON public.clinical_protocol_versions
FOR EACH ROW
EXECUTE FUNCTION public.protect_published_clinical_protocol_version();

DROP TRIGGER IF EXISTS touch_clinical_protocols_updated_at ON public.clinical_protocols;
CREATE TRIGGER touch_clinical_protocols_updated_at
BEFORE UPDATE ON public.clinical_protocols
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();