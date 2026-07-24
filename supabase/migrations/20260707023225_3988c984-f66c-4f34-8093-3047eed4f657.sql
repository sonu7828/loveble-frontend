INSERT INTO public.chart_note_templates (category, subtype, name, body, sort_order, is_active)
VALUES (
  'wellness',
  'perfect-derma-peel',
  'The Perfect Derma Peel',
  jsonb_build_object(
    'service_type', 'The Perfect Derma Peel',
    'layers_peels', '1 layer (standard). 2 layers if tolerated for deeper concerns.',
    'route', 'Topical',
    'assessment', 'Fitzpatrick reviewed. No active infection, open lesions, or contraindications. Pregnancy/lactation denied. Sun exposure and retinoid use reviewed. Prior peel history reviewed.',
    'plan', 'The Perfect Derma Peel applied per manufacturer protocol. Skin degreased with prep solution. Peel applied evenly in 1-2 layers per tolerance. Client instructed to leave solution on for 4-6 hours, do not wash, do not apply anything. Post-peel kit dispensed with instructions.',
    'post_care', 'Do not wash face for 4-6 hours. Peeling begins day 2-3, peaks day 3-5. Do not pick or peel skin. Apply post-peel towelette day 2, then moisturizer + SPF 30+ daily. Avoid sun, exercise, sweating, and active ingredients (retinoids, AHA/BHA, vitamin C) for 7 days. Full recovery ~7 days.',
    'followup', '2-4 weeks; series of 3-4 peels 4 weeks apart for best results.'
  ),
  25,
  true
);