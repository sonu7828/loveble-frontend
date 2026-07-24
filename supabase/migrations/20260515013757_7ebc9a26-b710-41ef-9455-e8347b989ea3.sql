-- Auto-sync appointment_consents.signed when a matching signature is inserted.
CREATE OR REPLACE FUNCTION public.sync_appointment_consent_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appointment_consents
     SET signed = true
   WHERE appointment_id = NEW.appointment_id
     AND consent_form_id = NEW.consent_form_id
     AND signed = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_consent_signed ON public.consent_signatures;
CREATE TRIGGER trg_sync_consent_signed
AFTER INSERT ON public.consent_signatures
FOR EACH ROW
EXECUTE FUNCTION public.sync_appointment_consent_signed();

-- Backfill: mark every appointment_consents row as signed if a matching signature exists.
UPDATE public.appointment_consents ac
   SET signed = true
  FROM public.consent_signatures cs
 WHERE cs.appointment_id = ac.appointment_id
   AND cs.consent_form_id = ac.consent_form_id
   AND ac.signed = false;