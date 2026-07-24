UPDATE public.appointments
SET service_id = '51000000-0000-0000-0000-000000000001', updated_at = now()
WHERE id = 'f95681a2-7477-4d3d-b8b3-38e01b54d788';

UPDATE public.appointment_services
SET service_id = '51000000-0000-0000-0000-000000000001'
WHERE appointment_id = 'f95681a2-7477-4d3d-b8b3-38e01b54d788';

INSERT INTO public.appointment_audit_log (appointment_id, action, notes)
VALUES ('f95681a2-7477-4d3d-b8b3-38e01b54d788', 'service_changed', 'Service changed from Complimentary Consultation to Neurotoxins (admin edit)');