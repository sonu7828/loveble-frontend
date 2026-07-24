
UPDATE public.services SET name = 'GLP-1 Wellness Management — Televisit' WHERE id = 'a1000000-0000-0000-0000-000000000002';
UPDATE public.services SET name = 'Peptide Therapy — Televisit' WHERE id = 'a1000000-0000-0000-0000-000000000003';
UPDATE public.services SET name = 'Retatrutide (Investigational Weight Management) — Televisit' WHERE id = 'a1000000-0000-0000-0000-000000000010';

INSERT INTO public.services (id, category_id, name, description, duration_minutes, price_cents, price_note, is_active, display_order, rebook_followup_days, is_featured)
SELECT 'a1000000-0000-0000-0000-0000000000a2', category_id, 'GLP-1 Wellness Management — In-Person', description, duration_minutes, price_cents, price_note, is_active, display_order + 100, rebook_followup_days, is_featured
FROM public.services WHERE id = 'a1000000-0000-0000-0000-000000000002';

INSERT INTO public.services (id, category_id, name, description, duration_minutes, price_cents, price_note, is_active, display_order, rebook_followup_days, is_featured)
SELECT 'a1000000-0000-0000-0000-0000000000a3', category_id, 'Peptide Therapy — In-Person', description, duration_minutes, price_cents, price_note, is_active, display_order + 100, rebook_followup_days, is_featured
FROM public.services WHERE id = 'a1000000-0000-0000-0000-000000000003';

INSERT INTO public.services (id, category_id, name, description, duration_minutes, price_cents, price_note, is_active, display_order, rebook_followup_days, is_featured)
SELECT 'a1000000-0000-0000-0000-0000000000b0', category_id, 'Retatrutide (Investigational Weight Management) — In-Person', description, duration_minutes, price_cents, price_note, is_active, display_order + 100, rebook_followup_days, is_featured
FROM public.services WHERE id = 'a1000000-0000-0000-0000-000000000010';

INSERT INTO public.service_providers (service_id, staff_id, location_id) VALUES
  ('a1000000-0000-0000-0000-0000000000a2','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111'),
  ('a1000000-0000-0000-0000-0000000000a2','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222'),
  ('a1000000-0000-0000-0000-0000000000a3','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111'),
  ('a1000000-0000-0000-0000-0000000000a3','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222'),
  ('a1000000-0000-0000-0000-0000000000b0','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111'),
  ('a1000000-0000-0000-0000-0000000000b0','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222');

INSERT INTO public.service_consents (service_id, consent_form_id)
SELECT CASE sc.service_id
  WHEN 'a1000000-0000-0000-0000-000000000002'::uuid THEN 'a1000000-0000-0000-0000-0000000000a2'::uuid
  WHEN 'a1000000-0000-0000-0000-000000000003'::uuid THEN 'a1000000-0000-0000-0000-0000000000a3'::uuid
  WHEN 'a1000000-0000-0000-0000-000000000010'::uuid THEN 'a1000000-0000-0000-0000-0000000000b0'::uuid
END, sc.consent_form_id
FROM public.service_consents sc
WHERE sc.service_id IN ('a1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000010');

INSERT INTO public.service_pre_op_instructions (service_id, title, body_markdown)
SELECT CASE service_id
  WHEN 'a1000000-0000-0000-0000-000000000002'::uuid THEN 'a1000000-0000-0000-0000-0000000000a2'::uuid
  WHEN 'a1000000-0000-0000-0000-000000000003'::uuid THEN 'a1000000-0000-0000-0000-0000000000a3'::uuid
  WHEN 'a1000000-0000-0000-0000-000000000010'::uuid THEN 'a1000000-0000-0000-0000-0000000000b0'::uuid
END, title, body_markdown
FROM public.service_pre_op_instructions
WHERE service_id IN ('a1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000010');

INSERT INTO public.service_post_op_instructions (service_id, title, body_markdown)
SELECT CASE service_id
  WHEN 'a1000000-0000-0000-0000-000000000002'::uuid THEN 'a1000000-0000-0000-0000-0000000000a2'::uuid
  WHEN 'a1000000-0000-0000-0000-000000000003'::uuid THEN 'a1000000-0000-0000-0000-0000000000a3'::uuid
  WHEN 'a1000000-0000-0000-0000-000000000010'::uuid THEN 'a1000000-0000-0000-0000-0000000000b0'::uuid
END, title, body_markdown
FROM public.service_post_op_instructions
WHERE service_id IN ('a1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000010');
