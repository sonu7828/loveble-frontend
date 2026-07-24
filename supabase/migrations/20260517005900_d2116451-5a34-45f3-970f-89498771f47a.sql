-- Ensure appointment_consents.signed stays in sync with consent_signatures
DROP TRIGGER IF EXISTS trg_sync_appointment_consent_signed ON public.consent_signatures;
CREATE TRIGGER trg_sync_appointment_consent_signed
AFTER INSERT ON public.consent_signatures
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_consent_signed();

-- Backfill: any appointment_consents row that already has a matching signature should be marked signed
UPDATE public.appointment_consents ac
SET signed = true
WHERE ac.signed = false
  AND EXISTS (
    SELECT 1 FROM public.consent_signatures cs
    WHERE cs.appointment_id = ac.appointment_id
      AND cs.consent_form_id = ac.consent_form_id
      AND cs.decision = 'consent'
  );