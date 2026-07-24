
-- Purge bogus intake submissions (missing HIPAA/truthful ack or signature) and reset appointment intake status
WITH bogus AS (
  SELECT id, appointment_id FROM public.client_intake_submissions
  WHERE hipaa_acknowledged IS NOT TRUE
     OR truthful_acknowledged IS NOT TRUE
     OR coalesce(trim(signature_full_name),'') = ''
), del AS (
  DELETE FROM public.client_intake_submissions
   WHERE id IN (SELECT id FROM bogus)
  RETURNING appointment_id
)
UPDATE public.appointments a
   SET intake_completed_at = NULL,
       intake_send_count = 0,
       intake_sent_at = NULL,
       intake_last_sent_at = NULL
 WHERE a.id IN (SELECT appointment_id FROM del)
   AND NOT EXISTS (
     SELECT 1 FROM public.client_intake_submissions s
      WHERE s.appointment_id = a.id
   );
