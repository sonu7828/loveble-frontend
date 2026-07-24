
-- 1. Reference data extensions on existing protocol versions
ALTER TABLE public.clinical_protocol_versions
  ADD COLUMN IF NOT EXISTS recommended_labs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_prescriptions jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE public.clinical_encounter_visit_type AS ENUM ('new', 'follow_up');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.clinical_encounter_status AS ENUM ('draft', 'signed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.clinical_encounter_decision AS ENUM ('increase','decrease','continue','discontinue','switch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. clinical_encounters
CREATE TABLE IF NOT EXISTS public.clinical_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_type public.clinical_encounter_visit_type NOT NULL,
  category public.clinical_protocol_category NOT NULL,
  reference_protocol_version_id uuid REFERENCES public.clinical_protocol_versions(id) ON DELETE SET NULL,
  client_email text NOT NULL,
  client_first_name text NOT NULL,
  client_last_name text NOT NULL,
  client_dob date,
  appointment_id uuid,
  chief_complaint text,
  subjective text,
  objective text,
  assessment text,
  plan text,
  counseling_acknowledged boolean NOT NULL DEFAULT false,
  necessity_attestation text,
  status public.clinical_encounter_status NOT NULL DEFAULT 'draft',
  signed_by_user_id uuid,
  signed_by_name text,
  signed_by_license text,
  signature_png text,
  signed_at timestamptz,
  clinical_pdf_url text,
  handout_pdf_url text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_encounters TO authenticated;
GRANT ALL ON public.clinical_encounters TO service_role;
ALTER TABLE public.clinical_encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "NPs and admins read encounters"
  ON public.clinical_encounters FOR SELECT TO authenticated
  USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "NPs and admins insert encounters"
  ON public.clinical_encounters FOR INSERT TO authenticated
  WITH CHECK (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "NPs and admins update encounters"
  ON public.clinical_encounters FOR UPDATE TO authenticated
  USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "Admins delete encounters"
  ON public.clinical_encounters FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_clinical_encounters_email ON public.clinical_encounters(client_email);
CREATE INDEX IF NOT EXISTS idx_clinical_encounters_created ON public.clinical_encounters(created_at DESC);

-- 4. labs
CREATE TABLE IF NOT EXISTS public.clinical_encounter_labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.clinical_encounters(id) ON DELETE CASCADE,
  analyte text NOT NULL,
  value text,
  unit text,
  drawn_on date,
  source text NOT NULL DEFAULT 'prior',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_encounter_labs TO authenticated;
GRANT ALL ON public.clinical_encounter_labs TO service_role;
ALTER TABLE public.clinical_encounter_labs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NPs and admins manage encounter labs"
  ON public.clinical_encounter_labs FOR ALL TO authenticated
  USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_encounter_labs_enc ON public.clinical_encounter_labs(encounter_id);

-- 5. prescriptions
CREATE TABLE IF NOT EXISTS public.clinical_encounter_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.clinical_encounters(id) ON DELETE CASCADE,
  drug text NOT NULL,
  strength text,
  route text,
  frequency text,
  duration text,
  dispense text,
  refills integer NOT NULL DEFAULT 0,
  titration jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_encounter_prescriptions TO authenticated;
GRANT ALL ON public.clinical_encounter_prescriptions TO service_role;
ALTER TABLE public.clinical_encounter_prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NPs and admins manage encounter rx"
  ON public.clinical_encounter_prescriptions FOR ALL TO authenticated
  USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_encounter_rx_enc ON public.clinical_encounter_prescriptions(encounter_id);

-- 6. followups
CREATE TABLE IF NOT EXISTS public.clinical_encounter_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.clinical_encounters(id) ON DELETE CASCADE,
  tolerability text,
  adverse_events text,
  objective_deltas text,
  decision public.clinical_encounter_decision,
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_encounter_followups TO authenticated;
GRANT ALL ON public.clinical_encounter_followups TO service_role;
ALTER TABLE public.clinical_encounter_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NPs and admins manage encounter followups"
  ON public.clinical_encounter_followups FOR ALL TO authenticated
  USING (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_nurse_practitioner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_encounter_fu_enc ON public.clinical_encounter_followups(encounter_id);

-- 7. Immutability trigger on signed encounters
CREATE OR REPLACE FUNCTION public.protect_signed_clinical_encounter()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'signed' AND NOT public.is_admin(auth.uid()) THEN
    IF NEW.visit_type IS DISTINCT FROM OLD.visit_type
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.client_email IS DISTINCT FROM OLD.client_email
       OR NEW.subjective IS DISTINCT FROM OLD.subjective
       OR NEW.objective IS DISTINCT FROM OLD.objective
       OR NEW.assessment IS DISTINCT FROM OLD.assessment
       OR NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.signature_png IS DISTINCT FROM OLD.signature_png
       OR NEW.signed_by_user_id IS DISTINCT FROM OLD.signed_by_user_id
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at THEN
      RAISE EXCEPTION 'Signed encounters are immutable. Use an addendum.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_signed_clinical_encounter_trg ON public.clinical_encounters;
CREATE TRIGGER protect_signed_clinical_encounter_trg
BEFORE UPDATE ON public.clinical_encounters
FOR EACH ROW EXECUTE FUNCTION public.protect_signed_clinical_encounter();

-- Block child-row edits on signed encounters
CREATE OR REPLACE FUNCTION public.protect_signed_encounter_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_status public.clinical_encounter_status;
BEGIN
  SELECT status INTO v_status FROM public.clinical_encounters
    WHERE id = COALESCE(NEW.encounter_id, OLD.encounter_id);
  IF v_status = 'signed' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Cannot modify child rows of a signed encounter.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_enc_labs_trg ON public.clinical_encounter_labs;
CREATE TRIGGER protect_enc_labs_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.clinical_encounter_labs
FOR EACH ROW EXECUTE FUNCTION public.protect_signed_encounter_child();

DROP TRIGGER IF EXISTS protect_enc_rx_trg ON public.clinical_encounter_prescriptions;
CREATE TRIGGER protect_enc_rx_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.clinical_encounter_prescriptions
FOR EACH ROW EXECUTE FUNCTION public.protect_signed_encounter_child();

DROP TRIGGER IF EXISTS protect_enc_fu_trg ON public.clinical_encounter_followups;
CREATE TRIGGER protect_enc_fu_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.clinical_encounter_followups
FOR EACH ROW EXECUTE FUNCTION public.protect_signed_encounter_child();
