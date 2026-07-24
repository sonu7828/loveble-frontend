
-- ============ SMS snippets library ============
CREATE TABLE IF NOT EXISTS public.sms_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  body text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_snippets TO authenticated;
GRANT ALL ON public.sms_snippets TO service_role;
ALTER TABLE public.sms_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read sms snippets"
  ON public.sms_snippets FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Admins manage sms snippets"
  ON public.sms_snippets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_sms_snippets_touch
  BEFORE UPDATE ON public.sms_snippets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed a few starter snippets
INSERT INTO public.sms_snippets (label, category, body, sort_order) VALUES
  ('Running late', 'logistics', 'Hi {first_name}, we''re running about 10 minutes behind today. Thanks for your patience — see you soon!', 10),
  ('On my way reminder', 'logistics', 'Hi {first_name}, just a friendly reminder of your appointment with Radiantilyk today. Reply C to confirm.', 20),
  ('Post-visit thank you', 'followup', 'Thanks for coming in today, {first_name}! Let us know if any questions come up. — Radiantilyk', 30),
  ('Review request', 'followup', 'Hi {first_name}, we''d love a quick Google review if you had a great experience: https://g.page/r/CRkA-review/review', 40),
  ('Late policy reminder', 'policy', 'Hi {first_name}, just a heads up — our cancellation window is 48 hours and a $200 fee applies for no-shows. Let us know if anything changes!', 50)
ON CONFLICT DO NOTHING;

-- ============ New compliance protocols ============
-- Everesse / Volnewmer (energy device)
INSERT INTO public.compliance_protocols (slug, title, category, summary, body_markdown, version, renewal_months, requires_license, applies_to_roles, published_at)
SELECT 'everesse-volnewmer', 'Everesse by Volnewmer RF Protocol', 'device',
'Monopolar RF tightening and contouring with Everesse by Volnewmer. Covers patient selection, energy settings, treatment grid, contraindications, and post-care.',
$md$## Indication
Non-invasive monopolar RF skin tightening and contouring (face, neck, jawline, body).

## Contraindications
- Pregnancy / breastfeeding
- Active infection or open wounds in treatment zone
- Implanted electronic devices (pacemaker, ICD)
- Metal implants in treatment area
- Active autoimmune flare, recent isotretinoin (<6 mo)
- Pacemaker, defibrillator, internal metal stents, cochlear implants

## Pre-treatment
- Verify ID, allergy review, photography release on file
- Confirm no Botox/filler in last 14 days in same zone
- Cleanse skin; remove metal jewelry
- Apply ultrasound/glide gel uniformly

## Settings & Grid
- Start: face 30–35 J, neck 25–30 J, body 40–55 J
- Tile-and-overlap technique, 3 passes per zone
- Hand-piece angle 90°, continuous motion
- Skin surface temp target 41–43 °C; pause if >44 °C

## Adverse Events
- Erythema, edema (expected, <48h)
- Blistering, burn (STOP, cool, document, MD notification)
- Nodule, fat atrophy (delayed; clinical photo, MD review)

## Post-care
- SPF 30+ daily
- Avoid heat/sauna 48h
- Optional NSAID for discomfort
- Follow-up at 4 and 12 weeks for collagen response photos$md$,
  1, 12, true, ARRAY['staff','nurse_practitioner','admin']::text[], now()
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_protocols WHERE slug = 'everesse-volnewmer');

-- Televisit
INSERT INTO public.compliance_protocols (slug, title, category, summary, body_markdown, version, renewal_months, requires_license, applies_to_roles, published_at)
SELECT 'televisit', 'Televisit / Virtual Visit Protocol', 'general',
'Standards for synchronous virtual visits including identity verification, HIPAA-compliant platform use, documentation, and limitations of remote care.',
$md$## Scope
Synchronous audio/video visits for follow-up, GLP-1 / peptide / HRT check-ins, mild adverse-event triage, and treatment planning.

## Out of Scope
- Initial in-person GFE for injectables (must be in-clinic)
- Acute emergencies (refer to ED / call 911)
- Procedural care

## Identity & Consent
- Verify patient identity at start (DOB + photo ID on file)
- Confirm patient location (state) — care only delivered when patient is in CA
- Verbal consent for televisit documented in chart

## Platform & Privacy
- HIPAA-compliant video platform only
- Private setting on both ends; no recording without written consent
- No PHI in SMS / email — use patient portal

## Documentation
- SOAP note within 24h
- Document modality (audio vs video), duration, location of patient
- Prescriptions: e-Rx only; no controlled substances via televisit
- Counsel on limitations and when to seek in-person care

## Emergency Plan
- If decompensation: instruct to call 911, document, follow up
- If symptoms outside scope: schedule in-clinic visit within 7 days$md$,
  1, 12, true, ARRAY['nurse_practitioner','admin']::text[], now()
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_protocols WHERE slug = 'televisit');
