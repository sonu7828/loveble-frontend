-- Allow "compliance" as a quick-phrase category
ALTER TABLE public.quick_phrases DROP CONSTRAINT IF EXISTS quick_phrases_category_check;
ALTER TABLE public.quick_phrases ADD CONSTRAINT quick_phrases_category_check
  CHECK (category = ANY (ARRAY['neurotoxin','filler','energy','wellness','compliance']));

-- Seed compliance smart phrases (idempotent: skip if any compliance phrase already exists)
INSERT INTO public.quick_phrases (category, phrase, sort_order, is_active)
SELECT 'compliance', phrase, ord, true FROM (VALUES
  ('HIPAA Notice of Privacy Practices reviewed; patient acknowledged understanding.', 1),
  ('Photographic consent obtained; images stored in encrypted PHI bucket only.', 2),
  ('Good Faith Exam completed and reviewed by NP; treatment plan within scope.', 3),
  ('Informed consent reviewed; risks, benefits, alternatives, and post-care discussed. Questions answered.', 4),
  ('Patient verbalized understanding of risks including bruising, swelling, asymmetry, vascular occlusion, and infection.', 5),
  ('Off-label use discussed; patient consented after disclosure.', 6),
  ('Treatment performed within scope of practice under standing-order / collaborative-practice agreement.', 7),
  ('Supervising physician/NP available by phone throughout procedure.', 8),
  ('Pre-procedure timeout completed: correct patient, correct product, correct site, correct dose.', 9),
  ('Lot number and expiration verified prior to administration; recorded in chart.', 10),
  ('Aseptic technique observed; skin prepped per protocol.', 11),
  ('Emergency protocol reviewed; hyaluronidase / epinephrine / AED accessible on site.', 12),
  ('No adverse event during or immediately following procedure; patient stable at discharge.', 13),
  ('Adverse event noted — see incident report; patient counseled and follow-up scheduled.', 14),
  ('Patient declined recommended treatment after risks reviewed; declination documented.', 15),
  ('Pregnancy/breastfeeding screening completed; patient denies.', 16),
  ('Allergy reconciliation completed; no new allergies since last visit.', 17),
  ('Medication reconciliation completed; current med list verified with patient.', 18),
  ('Post-care instructions provided in writing and reviewed verbally; patient verbalized understanding.', 19),
  ('Follow-up appointment offered and scheduled; patient given contact for after-hours concerns.', 20),
  ('Chaperone present during examination/treatment of sensitive area.', 21),
  ('Patient identity verified using two identifiers (name and date of birth).', 22),
  ('Telehealth GFE completed; audio/video verified, identity confirmed, consent obtained.', 23),
  ('Photographs uploaded to encrypted clinical-photos bucket; not shared without separate written marketing consent.', 24)
) AS s(phrase, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.quick_phrases WHERE category = 'compliance');