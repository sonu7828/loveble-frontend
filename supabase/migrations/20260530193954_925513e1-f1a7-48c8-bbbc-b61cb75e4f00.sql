UPDATE public.services SET description = CASE id
  WHEN '54000000-0000-0000-0000-000000000001'::uuid THEN 'Gentle, lunchtime-friendly chemical peel that exfoliates the surface to brighten dullness, smooth texture, and even out tone with little to no downtime.'
  WHEN '54000000-0000-0000-0000-000000000002'::uuid THEN 'Stronger medical-grade peel that targets sun damage, pigmentation, fine lines, and uneven texture. Expect light flaking for 3–5 days.'
  WHEN '54000000-0000-0000-0000-000000000003'::uuid THEN 'Signature medium-depth blend peel that improves melasma, sun spots, acne scars, and tone. Visible peeling on days 3–5; results unfold over 2 weeks.'
  WHEN '57000000-0000-0000-0000-000000000004'::uuid THEN 'Fractional CO₂ laser resurfacing for deep wrinkles, acne scars, and significant sun damage. One treatment delivers dramatic skin renewal; 5–7 days of social downtime.'
  WHEN 'dbcc56cd-d0b0-44d1-9709-0f65d2d30469'::uuid THEN 'Next-generation neurotoxin that softens expression lines (forehead, 11s, crow''s feet) with results that can last up to 6 months — longer than traditional Botox.'
  WHEN '52000000-0000-0000-0000-000000000001'::uuid THEN 'Hyaluronic-acid filler used to restore lost volume, contour cheeks and jawline, refine lips, and smooth deeper folds. Priced per syringe; longevity 6–18 months.'
  WHEN '56000000-0000-0000-0000-000000000001'::uuid THEN 'Radiofrequency + ultrasound device that tightens skin, contours the body and face, and softens cellulite. No downtime; series of 4–6 recommended.'
  WHEN '58000000-0000-0000-0000-000000000004'::uuid THEN 'Regenerative growth-factor add-on applied after microneedling or laser to accelerate healing, calm redness, and boost glow, firmness, and tone.'
  WHEN '5a000000-0000-0000-0000-000000000007'::uuid THEN 'Oxygenating facial that deep-cleans pores, exfoliates, and infuses skin with CO₂-activated serums for instant hydration and a luminous, plumped finish.'
  WHEN '58000000-0000-0000-0000-000000000002'::uuid THEN 'High-intensity electromagnetic muscle-stimulation that builds muscle and burns fat — the equivalent of thousands of crunches or squats per session. No downtime.'
  WHEN 'a8259a85-ac20-4335-80a3-7f4fa2c9624c'::uuid THEN 'High-intensity focused ultrasound that lifts and tightens the full face by stimulating deep collagen. Non-invasive alternative to a surgical lift; results build over 2–3 months.'
  WHEN 'd39d457c-82e6-449e-8148-cef95fb61ef0'::uuid THEN 'Targeted HIFU treatment that sharpens the jawline and tightens under-chin laxity by stimulating collagen at the foundational layer. No downtime.'
  WHEN '57000000-0000-0000-0000-000000000001'::uuid THEN 'Intense Pulsed Light photofacial that fades sun spots, broken capillaries, redness, and rosacea while evening out overall tone. Series of 3–5 recommended.'
  WHEN '59000000-0000-0000-0000-000000000001'::uuid THEN 'Permanent laser hair reduction for the upper lip. Series of 6–8 sessions spaced 4–6 weeks apart for best clearance.'
  WHEN '59000000-0000-0000-0000-000000000002'::uuid THEN 'Permanent laser hair reduction along the chin and jawline. Series of 6–8 sessions for optimal results.'
  WHEN '59000000-0000-0000-0000-000000000003'::uuid THEN 'Permanent laser hair reduction across the neck (front or back). Series of 6–8 sessions recommended.'
  WHEN '59000000-0000-0000-0000-000000000004'::uuid THEN 'Permanent laser hair reduction for the underarms — one of the fastest, most popular areas to treat. Series of 6–8 sessions.'
  WHEN '59000000-0000-0000-0000-000000000005'::uuid THEN 'Permanent laser hair reduction for the standard bikini line. Series of 6–8 sessions recommended.'
  WHEN '59000000-0000-0000-0000-000000000006'::uuid THEN 'Permanent laser hair reduction of the full Brazilian area. Series of 6–8 sessions for best clearance.'
  WHEN '59000000-0000-0000-0000-000000000007'::uuid THEN 'Permanent laser hair reduction across the full face. Series of 6–8 sessions; great for hormonally driven hair growth.'
  WHEN '59000000-0000-0000-0000-000000000008'::uuid THEN 'Permanent laser hair reduction for the abdomen, including the happy-trail area. Series of 6–8 sessions recommended.'
  WHEN '59000000-0000-0000-0000-000000000009'::uuid THEN 'Permanent laser hair reduction for full arms (or half arms by request). Series of 6–8 sessions recommended.'
  WHEN '59000000-0000-0000-0000-00000000000a'::uuid THEN 'Permanent laser hair reduction across the chest. Series of 6–8 sessions for best clearance.'
  WHEN '59000000-0000-0000-0000-00000000000b'::uuid THEN 'Permanent laser hair reduction for the full back. Series of 6–8 sessions recommended.'
  WHEN '59000000-0000-0000-0000-00000000000c'::uuid THEN 'Permanent laser hair reduction for the full legs. Series of 6–8 sessions recommended.'
  WHEN '5b000000-0000-0000-0000-000000000002'::uuid THEN 'Medical-grade LED therapy that calms acne, reduces inflammation, and stimulates collagen. Often added on after treatments to speed recovery.'
  WHEN '58000000-0000-0000-0000-000000000003'::uuid THEN 'Injectable fat-dissolving treatment (deoxycholic acid) used for stubborn small pockets such as under-chin fullness. Typically 2–4 sessions spaced 4–6 weeks apart.'
  WHEN '57000000-0000-0000-0000-000000000003'::uuid THEN 'Nd:YAG laser for vascular lesions, leg & facial veins, deeper pigment, and laser hair reduction on darker skin tones. Safe across skin types.'
  WHEN '51000000-0000-0000-0000-000000000001'::uuid THEN 'Botox or Dysport injections that relax expression muscles to smooth forehead lines, 11s, and crow''s feet. Results appear in 7–14 days and last 3–4 months. Priced per unit.'
  WHEN '55000000-0000-0000-0000-000000000001'::uuid THEN 'Automated micro-channels that trigger natural collagen and elastin production to refine pores, fine lines, tone, and superficial scarring. Series of 3 recommended.'
  WHEN '57000000-0000-0000-0000-000000000002'::uuid THEN 'Picosecond laser that targets melasma, sun spots, tattoos, and tone & texture irregularities with minimal downtime.'
  WHEN '5a000000-0000-0000-0000-00000000000a'::uuid THEN 'Italian-formulated bio-revitalization treatment combining TCA + kojic acid + hydrogen peroxide for firmer, brighter, more radiant skin — no needles, no downtime.'
  WHEN '53000000-0000-0000-0000-000000000002'::uuid THEN 'Calcium-hydroxyapatite biostimulator that delivers immediate lift plus long-term collagen renewal. Excellent for jawline, cheeks, and hand rejuvenation.'
  WHEN '5a000000-0000-0000-0000-000000000008'::uuid THEN 'Regenerative facial that combines microneedling-style infusion with exosomes and growth factors to repair, brighten, and rejuvenate at the cellular level.'
  WHEN '55000000-0000-0000-0000-000000000002'::uuid THEN 'Radiofrequency microneedling that combines collagen-stimulating micro-channels with RF energy deep in the skin to tighten, lift, and resurface. Series of 3 recommended.'
  WHEN '53000000-0000-0000-0000-000000000001'::uuid THEN 'Poly-L-lactic acid biostimulator that gradually rebuilds your own collagen to restore facial volume and firmness. Series of 2–3 sessions; results last up to 2 years.'
  WHEN '57000000-0000-0000-0000-000000000005'::uuid THEN 'FDA-cleared microfocused ultrasound that lifts the brow, jawline, and neck by stimulating deep foundational collagen. No downtime; results unfold over 2–3 months.'
  WHEN '5a000000-0000-0000-0000-000000000009'::uuid THEN 'Signature reset facial — deep cleanse, gentle exfoliation, custom mask, lymphatic massage, and LED — for instant glow and calm, hydrated skin.'
  WHEN '57000000-0000-0000-0000-000000000006'::uuid THEN 'Korea''s premier monopolar RF skin-tightening platform that delivers visible lift and tightening across face, neck, and body in a single session. No downtime.'
END
WHERE id IN (
  '54000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000002','54000000-0000-0000-0000-000000000003',
  '57000000-0000-0000-0000-000000000004','dbcc56cd-d0b0-44d1-9709-0f65d2d30469','52000000-0000-0000-0000-000000000001',
  '56000000-0000-0000-0000-000000000001','58000000-0000-0000-0000-000000000004','5a000000-0000-0000-0000-000000000007',
  '58000000-0000-0000-0000-000000000002','a8259a85-ac20-4335-80a3-7f4fa2c9624c','d39d457c-82e6-449e-8148-cef95fb61ef0',
  '57000000-0000-0000-0000-000000000001','59000000-0000-0000-0000-000000000001','59000000-0000-0000-0000-000000000002',
  '59000000-0000-0000-0000-000000000003','59000000-0000-0000-0000-000000000004','59000000-0000-0000-0000-000000000005',
  '59000000-0000-0000-0000-000000000006','59000000-0000-0000-0000-000000000007','59000000-0000-0000-0000-000000000008',
  '59000000-0000-0000-0000-000000000009','59000000-0000-0000-0000-00000000000a','59000000-0000-0000-0000-00000000000b',
  '59000000-0000-0000-0000-00000000000c','5b000000-0000-0000-0000-000000000002','58000000-0000-0000-0000-000000000003',
  '57000000-0000-0000-0000-000000000003','51000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001',
  '57000000-0000-0000-0000-000000000002','5a000000-0000-0000-0000-00000000000a','53000000-0000-0000-0000-000000000002',
  '5a000000-0000-0000-0000-000000000008','55000000-0000-0000-0000-000000000002','53000000-0000-0000-0000-000000000001',
  '57000000-0000-0000-0000-000000000005','5a000000-0000-0000-0000-000000000009','57000000-0000-0000-0000-000000000006'
);