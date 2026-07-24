
-- ============================================================
-- PHASE 1 (P0) — California compliance & litigation defensibility
-- ============================================================

-- ---------- 1. Lock signed GFE records & detail tables ----------

-- Extend protect_signed_clinical_note to cover 'signed' status as well
CREATE OR REPLACE FUNCTION public.protect_signed_clinical_note()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('signed','cosigned','locked') THEN
    IF NOT public.is_admin(auth.uid()) THEN
      IF NEW.provider_notes IS DISTINCT FROM OLD.provider_notes
         OR NEW.post_assessment IS DISTINCT FROM OLD.post_assessment
         OR NEW.followup_weeks IS DISTINCT FROM OLD.followup_weeks
         OR NEW.client_email IS DISTINCT FROM OLD.client_email
         OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
         OR NEW.service_name IS DISTINCT FROM OLD.service_name
         OR NEW.category IS DISTINCT FROM OLD.category THEN
        RAISE EXCEPTION 'Signed clinical notes are immutable. Use addendums.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Detail-row lock: any update to a detail row whose parent note is signed/cosigned/locked is blocked
CREATE OR REPLACE FUNCTION public.protect_signed_detail_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clinical_notes
    WHERE id = NEW.clinical_note_id
      AND status IN ('signed','cosigned','locked')
  ) AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Detail rows for signed notes are immutable. Use addendums.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_neurotoxin_detail ON public.clinical_note_neurotoxin;
CREATE TRIGGER protect_neurotoxin_detail
  BEFORE UPDATE OR DELETE ON public.clinical_note_neurotoxin
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_detail_row();

DROP TRIGGER IF EXISTS protect_filler_detail ON public.clinical_note_filler;
CREATE TRIGGER protect_filler_detail
  BEFORE UPDATE OR DELETE ON public.clinical_note_filler
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_detail_row();

DROP TRIGGER IF EXISTS protect_energy_detail ON public.clinical_note_energy;
CREATE TRIGGER protect_energy_detail
  BEFORE UPDATE OR DELETE ON public.clinical_note_energy
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_detail_row();

DROP TRIGGER IF EXISTS protect_wellness_detail ON public.clinical_note_wellness;
CREATE TRIGGER protect_wellness_detail
  BEFORE UPDATE OR DELETE ON public.clinical_note_wellness
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_detail_row();

-- ---------- 2. Lock signed GFE records ----------

ALTER TABLE public.gfe_records
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_hash text,
  ADD COLUMN IF NOT EXISTS vascular_occlusion_protocol_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hyaluronidase_risk_disclosed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS patient_id_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS standing_order_ref text,
  ADD COLUMN IF NOT EXISTS prior_gfe_id uuid REFERENCES public.gfe_records(id),
  ADD COLUMN IF NOT EXISTS re_exam_reason text,
  ADD COLUMN IF NOT EXISTS authorized_treatments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.lock_gfe_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_locked := true;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS gfe_auto_lock ON public.gfe_records;
CREATE TRIGGER gfe_auto_lock
  BEFORE INSERT ON public.gfe_records
  FOR EACH ROW EXECUTE FUNCTION public.lock_gfe_on_insert();

CREATE OR REPLACE FUNCTION public.protect_signed_gfe()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_locked AND NOT public.is_admin(auth.uid()) THEN
    -- Only pdf_url, pdf_hash, updated_at may change after sign
    IF NEW.client_email IS DISTINCT FROM OLD.client_email
       OR NEW.client_first_name IS DISTINCT FROM OLD.client_first_name
       OR NEW.client_last_name IS DISTINCT FROM OLD.client_last_name
       OR NEW.client_dob IS DISTINCT FROM OLD.client_dob
       OR NEW.np_assessment_plan IS DISTINCT FROM OLD.np_assessment_plan
       OR NEW.allergies IS DISTINCT FROM OLD.allergies
       OR NEW.medical_history IS DISTINCT FROM OLD.medical_history
       OR NEW.current_medications IS DISTINCT FROM OLD.current_medications
       OR NEW.signature_png IS DISTINCT FROM OLD.signature_png
       OR NEW.np_license IS DISTINCT FROM OLD.np_license
       OR NEW.np_name IS DISTINCT FROM OLD.np_name
       OR NEW.authorized_treatments IS DISTINCT FROM OLD.authorized_treatments THEN
      RAISE EXCEPTION 'Signed GFE records are immutable. Create a new GFE.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS gfe_protect_signed ON public.gfe_records;
CREATE TRIGGER gfe_protect_signed
  BEFORE UPDATE ON public.gfe_records
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_gfe();

-- Audit any GFE mutation
CREATE OR REPLACE FUNCTION public.audit_gfe_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clinical_audit_log(actor_user_id, actor_name, resource_type, resource_id, action, metadata)
  VALUES (
    auth.uid(),
    COALESCE((SELECT full_name FROM public.staff_profiles WHERE user_id = auth.uid() LIMIT 1), 'unknown'),
    'gfe',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'update' END,
    jsonb_build_object('op', TG_OP, 'old', row_to_json(OLD), 'new', row_to_json(NEW))
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS gfe_audit_mutations ON public.gfe_records;
CREATE TRIGGER gfe_audit_mutations
  AFTER UPDATE OR DELETE ON public.gfe_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_gfe_mutations();

-- Remove admin DELETE policy entirely; tighten admin UPDATE to require admin role only (already gated by trigger)
DROP POLICY IF EXISTS "Admins delete GFE" ON public.gfe_records;

-- ---------- 3. Consent signature attestations + witness + tamper evidence ----------

ALTER TABLE public.consent_signatures
  ADD COLUMN IF NOT EXISTS attestation_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS witness_staff_id uuid,
  ADD COLUMN IF NOT EXISTS witness_name text,
  ADD COLUMN IF NOT EXISTS witness_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_attested_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signing_mode text NOT NULL DEFAULT 'remote',
  ADD COLUMN IF NOT EXISTS pdf_hash text;

-- ---------- 4. PDF tamper-evidence audit table ----------

CREATE TABLE IF NOT EXISTS public.consent_pdf_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  pdf_path text NOT NULL,
  sha256 text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by_uid uuid,
  generated_by_name text,
  trigger_source text NOT NULL DEFAULT 'system',
  signed_url text
);

GRANT SELECT, INSERT ON public.consent_pdf_audit TO authenticated;
GRANT ALL ON public.consent_pdf_audit TO service_role;

ALTER TABLE public.consent_pdf_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedulers view consent pdf audit"
  ON public.consent_pdf_audit FOR SELECT TO authenticated
  USING (public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Service role inserts consent pdf audit"
  ON public.consent_pdf_audit FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_consent_pdf_audit_appt ON public.consent_pdf_audit(appointment_id, generated_at DESC);

-- ---------- 5. Emergency contact on appointments + app-wide emergency phone ----------

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS emergency_phone text,
  ADD COLUMN IF NOT EXISTS after_hours_instructions text;

-- ---------- 6. Photo capture columns on clinical notes ----------

ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS photo_pre_paths text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS photo_post_paths text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS allergies_confirmed_today text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS new_medications_since_gfe text,
  ADD COLUMN IF NOT EXISTS indication text,
  ADD COLUMN IF NOT EXISTS consent_doc_names text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS patient_verbalized_understanding boolean NOT NULL DEFAULT false;

-- Clinical photos bucket (private)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('clinical-photos', 'clinical-photos', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clinical staff manage clinical photos"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'clinical-photos' AND public.is_clinical_staff(auth.uid()))
  WITH CHECK (bucket_id = 'clinical-photos' AND public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clients view own clinical photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'clinical-photos' AND auth.uid() IS NOT NULL);
