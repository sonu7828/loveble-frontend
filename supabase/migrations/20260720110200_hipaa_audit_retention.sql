-- Migration: Enforce HIPAA Audit Retention and Immutability

-- 1. Remove ON DELETE CASCADE from appointment_audit_log
-- By dropping the foreign key constraint entirely (like clinical_audit_log),
-- we ensure the audit trail survives even if the parent appointment is deleted.
ALTER TABLE public.appointment_audit_log
  DROP CONSTRAINT IF EXISTS appointment_audit_log_appointment_id_fkey;

-- 2. Create the PL/pgSQL function to block modifications
CREATE OR REPLACE FUNCTION public.block_audit_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable for HIPAA compliance';
END;
$$ LANGUAGE plpgsql;

-- 3. Attach BEFORE UPDATE OR DELETE triggers to audit tables
DROP TRIGGER IF EXISTS trg_block_appointment_audit_mod ON public.appointment_audit_log;
CREATE TRIGGER trg_block_appointment_audit_mod
  BEFORE UPDATE OR DELETE ON public.appointment_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.block_audit_modification();

DROP TRIGGER IF EXISTS trg_block_clinical_audit_mod ON public.clinical_audit_log;
CREATE TRIGGER trg_block_clinical_audit_mod
  BEFORE UPDATE OR DELETE ON public.clinical_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.block_audit_modification();

DROP TRIGGER IF EXISTS trg_block_consent_pdf_audit_mod ON public.consent_pdf_audit;
CREATE TRIGGER trg_block_consent_pdf_audit_mod
  BEFORE UPDATE OR DELETE ON public.consent_pdf_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.block_audit_modification();

-- 4. Document the 6-year retention policy directly in the database
COMMENT ON TABLE public.appointment_audit_log IS 'HIPAA Compliant Audit Log. Must be retained for at least 6 years. Records are strictly immutable.';
COMMENT ON TABLE public.clinical_audit_log IS 'HIPAA Compliant Audit Log. Must be retained for at least 6 years. Records are strictly immutable.';
COMMENT ON TABLE public.consent_pdf_audit IS 'HIPAA Compliant Audit Log. Must be retained for at least 6 years. Records are strictly immutable.';
