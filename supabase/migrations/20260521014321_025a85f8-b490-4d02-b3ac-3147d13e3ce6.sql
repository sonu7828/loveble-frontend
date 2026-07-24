
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_recurrence_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_recurrence_check
  CHECK (recurrence = ANY (ARRAY['once'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'every_3_weeks'::text]));

INSERT INTO public.marketing_campaigns (
  slug, name, subject, preview_text, body_markdown, cta_label, cta_url,
  audience_type, audience_params, status, recurrence, cooldown_days,
  scheduled_at, hero_image_url
) VALUES (
  'bestie-friday-2026',
  'Bring Your Bestie Friday',
  'Bring your bestie this Friday — you both get 15% off',
  'Beauty is better together. 15% off every Friday when you bring a friend.',
  E'Hi {{first_name}},\n\nIt''s **Bestie Friday** at Radiantilyk Aesthetic — and beauty is always better together.\n\nBring your favorite friend in on **any Friday** and you''ll **both get 15% off** your service. Whether it''s a glow-up before brunch, a HydraFacial date, or a tox + filler refresh — make it a ritual you share.\n\n**Why you''ll love Bestie Friday:**\n- Look good together\n- Feel confident together\n- Every Friday is for besties\n- Beauty is better together\n\nBook side-by-side appointments at our San Jose or San Mateo location. Mention "Bestie Friday" at checkout — discount applies to both services.\n\nSee you Friday,\nThe Radiantilyk Aesthetic team',
  'Book Bestie Friday',
  'https://bookrka.com/book',
  'all_clients',
  '{}'::jsonb,
  'active',
  'every_3_weeks',
  21,
  '2026-05-27 17:00:00+00'::timestamptz,
  'https://moqxtvbdgfambpmmslrr.supabase.co/storage/v1/object/public/marketing-assets/campaigns%2Fbestie-friday.png'
);
