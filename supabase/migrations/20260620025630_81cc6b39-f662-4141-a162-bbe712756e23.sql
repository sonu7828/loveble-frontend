UPDATE public.appointment_consents ac
SET signed = true
FROM public.consent_signatures cs
WHERE cs.appointment_id = ac.appointment_id
  AND cs.consent_form_id = ac.consent_form_id
  AND ac.signed = false;

CREATE OR REPLACE FUNCTION public.sync_appointment_consent_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.appointment_consents
     SET signed = true
   WHERE appointment_id = NEW.appointment_id
     AND consent_form_id = NEW.consent_form_id
     AND signed = false;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_appointment_consent_signed_on_signature ON public.consent_signatures;
CREATE TRIGGER sync_appointment_consent_signed_on_signature
AFTER INSERT OR UPDATE OF decision, signed_at ON public.consent_signatures
FOR EACH ROW
EXECUTE FUNCTION public.sync_appointment_consent_signed();