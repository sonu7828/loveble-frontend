-- Rename existing televisit for cleaner display
UPDATE public.services
SET name = 'Televisit: GLP-1 / HRT / Peptides',
    price_note = 'Initial televisit complimentary · medications, labs & pharmacy fees billed separately'
WHERE id = '5d000000-0000-0000-0000-000000000001';

-- Insert Neurotoxin Follow-Up (Televisit category)
INSERT INTO public.services (id, category_id, name, description, duration_minutes, price_cents, price_note, display_order, is_active, skip_consents, requires_consult)
VALUES (
  '5d000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000099',
  'Neurotoxin Follow-Up',
  '2-week neurotoxin touch-up check after your treatment.',
  15, 0, 'Complimentary follow-up',
  20, true, true, false
);

-- Insert Televisit Follow-Up (Televisit category)
INSERT INTO public.services (id, category_id, name, description, duration_minutes, price_cents, price_note, display_order, is_active, skip_consents, requires_consult)
VALUES (
  '5d000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000099',
  'Televisit Follow-Up',
  'Follow-up televisit for GLP-1, HRT, or peptide therapy.',
  15, 0, 'Complimentary follow-up',
  30, true, true, false
);

-- Mirror the existing Televisit provider/location assignments
INSERT INTO public.service_providers (service_id, staff_id, location_id)
SELECT new_id, staff_id, location_id
FROM (VALUES
  ('5d000000-0000-0000-0000-000000000002'::uuid),
  ('5d000000-0000-0000-0000-000000000003'::uuid)
) AS n(new_id)
CROSS JOIN public.service_providers
WHERE service_id = '5d000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;