ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO public.services (id, category_id, name, description, duration_minutes, price_cents, price_note, promo_group, display_order, is_active, image_url)
VALUES
  ('5a000006-0000-0000-0000-000000000a01'::uuid, 'c1000000-0000-0000-0000-000000000001',
    'June Special — New Client Neurotoxin (30 units)',
    'Welcome offer for first-time Radiantilyk clients. Includes a full provider consultation and 30 units of FDA-approved neurotoxin (Botox, Dysport, Xeomin, or Jeuveau — provider choice based on goals) targeting your choice of forehead, frown (11s), or crow''s feet. Results begin in 3–5 days, peak at 2 weeks, and last ~3–4 months. Cannot combine with other offers. Available all of June 2026.',
    45, 25900,
    E'New clients only • 30 units included\nFlat $259 (a $329 value)',
    'june-2026-newclient-toxin', 1, true,
    '/src/assets/june-special-neurotoxin.jpg'),
  ('5a000006-0000-0000-0000-000000000a02'::uuid, 'c1000000-0000-0000-0000-000000000005',
    'June Special — Pen Microneedling 10% Off',
    'Our signature SkinPen® microneedling treatment, 10% off for June. Creates controlled micro-channels to stimulate collagen and elastin — ideal for fine lines, texture, pores, and acne scarring. Includes numbing, growth-factor serum, and a calming LED finish. A series of 3 is recommended for best results.',
    75, 36000,
    E'Save $40 — 10% off regular $400\nValid June 2026 only',
    'june-2026-microneedling', 2, true,
    '/src/assets/june-special-microneedling.jpg'),
  ('5a000006-0000-0000-0000-000000000a03'::uuid, 'c1000000-0000-0000-0000-000000000003',
    'June Special — Sculptra Buy 2 Get 1 Free',
    'Buy 2 vials of Sculptra® and receive a third vial free — or trade the free vial for a complimentary RF Microneedling session or CO₂ Laser resurfacing for the face. Sculptra is a poly-L-lactic acid biostimulator that gradually rebuilds your own collagen for natural, long-lasting volume and skin quality improvement over 3–6 months. Full series typically requires 2–3 sessions.',
    90, 160000,
    E'$1,600 for 3 vials (buy 2, get 1 free)\nOr swap the free vial for RF Microneedling or CO₂ Laser — face',
    'june-2026-sculptra', 3, true,
    '/src/assets/june-special-sculptra.jpg');

INSERT INTO public.service_pre_op_instructions (service_id, title, body_markdown)
SELECT '5a000006-0000-0000-0000-000000000a01'::uuid, title, body_markdown FROM public.service_pre_op_instructions WHERE service_id = '51000000-0000-0000-0000-000000000001'
ON CONFLICT (service_id) DO NOTHING;
INSERT INTO public.service_pre_op_instructions (service_id, title, body_markdown)
SELECT '5a000006-0000-0000-0000-000000000a02'::uuid, title, body_markdown FROM public.service_pre_op_instructions WHERE service_id = '55000000-0000-0000-0000-000000000001'
ON CONFLICT (service_id) DO NOTHING;
INSERT INTO public.service_pre_op_instructions (service_id, title, body_markdown)
SELECT '5a000006-0000-0000-0000-000000000a03'::uuid, title, body_markdown FROM public.service_pre_op_instructions WHERE service_id = '53000000-0000-0000-0000-000000000001'
ON CONFLICT (service_id) DO NOTHING;

INSERT INTO public.service_post_op_instructions (service_id, title, body_markdown)
SELECT '5a000006-0000-0000-0000-000000000a01'::uuid, title, body_markdown FROM public.service_post_op_instructions WHERE service_id = '51000000-0000-0000-0000-000000000001'
ON CONFLICT (service_id) DO NOTHING;
INSERT INTO public.service_post_op_instructions (service_id, title, body_markdown)
SELECT '5a000006-0000-0000-0000-000000000a02'::uuid, title, body_markdown FROM public.service_post_op_instructions WHERE service_id = '55000000-0000-0000-0000-000000000001'
ON CONFLICT (service_id) DO NOTHING;
INSERT INTO public.service_post_op_instructions (service_id, title, body_markdown)
SELECT '5a000006-0000-0000-0000-000000000a03'::uuid, title, body_markdown FROM public.service_post_op_instructions WHERE service_id = '53000000-0000-0000-0000-000000000001'
ON CONFLICT (service_id) DO NOTHING;

INSERT INTO public.service_providers (service_id, staff_id, location_id)
SELECT '5a000006-0000-0000-0000-000000000a01'::uuid, staff_id, location_id FROM public.service_providers WHERE service_id = '51000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;
INSERT INTO public.service_providers (service_id, staff_id, location_id)
SELECT '5a000006-0000-0000-0000-000000000a02'::uuid, staff_id, location_id FROM public.service_providers WHERE service_id = '55000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;
INSERT INTO public.service_providers (service_id, staff_id, location_id)
SELECT '5a000006-0000-0000-0000-000000000a03'::uuid, staff_id, location_id FROM public.service_providers WHERE service_id = '53000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;