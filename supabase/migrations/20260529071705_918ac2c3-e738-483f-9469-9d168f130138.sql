-- Grant Kiem the Nurse Practitioner role so she can sign GFEs (per CA B&P §2242)
INSERT INTO public.user_roles (user_id, role)
VALUES ('1076098a-8598-42b3-bb32-25cb591ce677', 'nurse_practitioner')
ON CONFLICT (user_id, role) DO NOTHING;

-- Undo check-in for Inderpreet Sandhar's appointment today
UPDATE public.appointments
SET status = 'approved',
    checked_in_at = NULL,
    checked_in_by = NULL
WHERE id = '34d3764c-e2b3-4d18-9a79-2f34f92d27bc';