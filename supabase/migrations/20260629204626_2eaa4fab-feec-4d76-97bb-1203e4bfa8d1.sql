
-- 1. Chart-note templates
CREATE TABLE IF NOT EXISTS public.chart_note_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('neurotoxin','filler','energy','wellness')),
  subtype text,
  name text NOT NULL,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_note_templates TO authenticated;
GRANT ALL ON public.chart_note_templates TO service_role;

ALTER TABLE public.chart_note_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff can view active templates"
  ON public.chart_note_templates FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Admins manage templates - insert"
  ON public.chart_note_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage templates - update"
  ON public.chart_note_templates FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage templates - delete"
  ON public.chart_note_templates FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_chart_note_templates_updated
  BEFORE UPDATE ON public.chart_note_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_chart_note_templates_cat ON public.chart_note_templates(category, is_active, sort_order);

-- 2. Saved signatures on staff_profiles
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS saved_signature_png text,
  ADD COLUMN IF NOT EXISTS saved_signature_name text,
  ADD COLUMN IF NOT EXISTS signature_saved_at timestamptz;

-- 3. Seed templates
INSERT INTO public.chart_note_templates (category, subtype, name, body, sort_order) VALUES
-- Filler
('filler', 'lip', 'Lip filler (Juvederm/RHA)', '{"product":"Juvederm Ultra XC","areas":["Upper lip","Lower lip"],"technique":"Linear threading + microbolus","needle_gauge":"30G needle","volume_ml":"1.0","provider_notes":"Pre-treatment: ice + topical 23% lidocaine 20 min. Pinch test (-). Marked anatomy. Aspirated each pass; no flash. Massaged to even contour. Tolerated well, no AEs.","post_assessment":"Symmetric, vermillion border defined, projection improved. Patient pleased."}', 10),
('filler', 'cheek', 'Cheek filler (Voluma)', '{"product":"Juvederm Voluma XC","areas":["Right mid-cheek","Left mid-cheek"],"technique":"Supraperiosteal bolus, cannula sweep","needle_gauge":"22G cannula","volume_ml":"2.0","provider_notes":"Topical 23% lidocaine x 20 min. Entry points marked at Hinderer line. 22G cannula via lateral entry. Bolus deep to SMAS; molded. No vascular event.","post_assessment":"Mid-face volumized, lifted nasolabial. Symmetric."}', 20),
('filler', 'sculptra', 'Sculptra full face', '{"product":"Sculptra (PLLA)","areas":["Temples","Mid-cheek","Pre-jowl"],"technique":"Subdermal cannula fanning","needle_gauge":"25G cannula","volume_ml":"2 vials reconstituted 8mL ea","provider_notes":"Reconstituted >72hr per protocol. Topical 23% lido. Entry points sterilized. Subdermal fan with 25G cannula bilaterally. Aspirated; no flash. Vigorous massage 5/5/5 advised.","post_assessment":"Volumization initiated; gradual collagen stimulation expected over 8-12 weeks."}', 30),
('filler', 'radiesse', 'Radiesse jawline', '{"product":"Radiesse (+)","areas":["Right jawline","Left jawline","Chin"],"technique":"Supraperiosteal bolus + cannula","needle_gauge":"25G cannula","volume_ml":"1.5","provider_notes":"Topical 23% lidocaine. Marked along mandibular border. Radiesse (+) mixed with 0.3 mL 1% lidocaine. 25G cannula retrograde linear threading along jawline.","post_assessment":"Jawline definition improved; chin projection enhanced. Symmetric."}', 40),
-- Energy / Laser
('energy', 'microneedling', 'Pen microneedling face', '{"device":"Pen microneedling","areas":["Forehead","Cheeks","Chin","Perioral"],"depth_mm":"0.5-1.5","passes":"3","provider_notes":"Topical 23% lidocaine x 25 min, removed. Cleansed with chlorhexidine. Pen microneedling at 0.5mm forehead, 1.0mm cheeks, 1.5mm acne scars. 3 passes (vertical/horizontal/diagonal). Pinpoint bleeding endpoint. Hyaluronic acid applied.","post_assessment":"Even erythema, controlled pinpoint bleeding. Post-care reviewed: SPF, no actives x 48h.","fluence":"","spot_size":"","cooling":"Hyaluronic acid serum","endpoint":"Pinpoint bleeding"}', 10),
('energy', 'rf_microneedling', 'RF microneedling (Morpheus/Everesse)', '{"device":"Everesse (Volnewmer monopolar RF)","areas":["Full face","Neck"],"depth_mm":"2.0-4.0","passes":"2","provider_notes":"Topical 23% lidocaine x 30 min. Cleansed. Settings: depth 2.0-4.0mm, energy level adjusted per area. 2 passes per zone. Mild erythema and edema noted. Cool compresses applied.","post_assessment":"Even response, no PIH risk identified. Downtime 2-3 days reviewed.","fluence":"","spot_size":"","cooling":"Cool compress","endpoint":"Erythema + mild edema"}', 20),
('energy', 'ndyag', 'Nd:YAG vascular', '{"device":"Nd:YAG 1064nm","areas":["Cheeks","Nose"],"depth_mm":"","passes":"1-2","provider_notes":"Patient supine, eye shields in place. Test spot performed; no adverse response. Treated visible vessels with 1064nm Nd:YAG. Endpoint: vessel blanching/darkening. Cool air during treatment.","post_assessment":"Targeted vessels treated; expected mild erythema 24-48h. Post-care: SPF, avoid heat x 48h.","fluence":"140 J/cm²","spot_size":"3mm","cooling":"Cryogen / cool air","endpoint":"Vessel blanching"}', 30),
('energy', 'ipl', 'IPL / BBL photofacial', '{"device":"IPL/BBL","areas":["Full face","Décolleté"],"depth_mm":"","passes":"1-2","provider_notes":"Fitzpatrick II-III confirmed. Eye shields. Ultrasound gel applied. 515-560nm filter for pigment, 560nm for vascular. Single pass full face, 2nd pass on lentigines. Endpoint: subtle darkening of pigment, mild perilesional erythema.","post_assessment":"Pigment darkening as expected; will slough 7-10 days. SPF strict. No exfoliants x 7d.","fluence":"16 J/cm²","spot_size":"15x35mm","cooling":"Contact cooling","endpoint":"Pigment darkening"}', 40),
('energy', 'laser_hair', 'Laser hair removal', '{"device":"Diode / Nd:YAG","areas":["Underarms","Bikini","Legs"],"depth_mm":"","passes":"1","provider_notes":"Skin shaved, cleansed. Fitzpatrick confirmed. Test spot acceptable. Single pass full area with overlapping coverage. Endpoint: perifollicular erythema and edema. Cool compress applied.","post_assessment":"Expected response. Aftercare: no sun x 2 weeks, no waxing/plucking between sessions.","fluence":"","spot_size":"","cooling":"Contact cooling","endpoint":"Perifollicular erythema"}', 50),
('energy', 'glo2', 'Glo2 Facial', '{"device":"Glo2Facial (OxyGeneo)","areas":["Full face"],"depth_mm":"","passes":"","provider_notes":"Cleansed. Exfoliated with OxyPod (selected formula). CO2 bubbling oxygenation step. Ultrasound infusion of serum 6 min. LED red light 8 min. Hydrating finish.","post_assessment":"Skin hydrated, even tone, minimal erythema. No downtime.","fluence":"","spot_size":"","cooling":"","endpoint":"Glow, hydration"}', 60),
-- Wellness / Weight loss
('wellness', 'semaglutide', 'Semaglutide initiation', '{"product":"Compounded Semaglutide","areas":[],"provider_notes":"Indication: weight management, BMI documented. Reviewed contraindications: personal/FHx MTC, MEN2, pancreatitis — negative. Baseline labs reviewed (TSH, A1c, CMP, lipid). Starting dose 0.25 mg SC weekly x 4 weeks, titrate per protocol. Counseled GI side effects, injection technique, hydration, nausea management.","post_assessment":"Patient verbalized understanding. Follow-up 4 weeks for titration. Red flags discussed: persistent severe abdominal pain → ER."}', 10),
('wellness', 'tirzepatide', 'Tirzepatide titration', '{"product":"Compounded Tirzepatide","areas":[],"provider_notes":"Tolerating prior dose without significant GI effects. Weight, vitals, glucose reviewed. Titrating to next dose per protocol. Reinforced lifestyle, protein intake, hydration, resistance training.","post_assessment":"Continue titration. Follow-up 4 weeks. Labs at 12 weeks (CMP, A1c)."}', 20),
('wellness', 'retatrutide', 'Retatrutide titration', '{"product":"Compounded Retatrutide","areas":[],"provider_notes":"Tolerance assessed. Weight loss trajectory reviewed. Titration per protocol. Lifestyle reinforcement.","post_assessment":"Follow-up 4 weeks. Continue protocol. Labs as scheduled."}', 30),
('wellness', 'hrt', 'HRT initial visit', '{"product":"Bioidentical hormone therapy","areas":[],"provider_notes":"Comprehensive intake reviewed. Symptoms scored. Baseline labs (estradiol, FSH, testosterone total/free, SHBG, TSH, CBC, CMP, lipid, hs-CRP). Risks/benefits of HRT discussed. Pellet vs cream vs injection options presented. Shared decision making documented.","post_assessment":"Treatment plan personalized; follow-up after labs return. Patient understands monitoring requirements."}', 40),
('wellness', 'peptide', 'Peptide therapy', '{"product":"Peptide therapy","areas":[],"provider_notes":"Indication clarified (recovery / longevity / GH support). Contraindications reviewed (active malignancy — negative). Baseline labs reviewed. Protocol selected and dosing reviewed. Injection technique demonstrated.","post_assessment":"Patient verbalized understanding. Follow-up 6-8 weeks with repeat labs as indicated."}', 50),
-- Neurotoxin
('neurotoxin', 'standard', 'Standard upper face (forehead/glabella/crow''s feet)', '{"product":"Botox","areas":["Frontalis","Glabella","Lateral canthus"],"provider_notes":"Topical ice prn. Sites marked at rest and animation. Aseptic technique. Aspirated each pass; no flash. Bleb wheals confirmed. Patient counseled: no bending/lying flat x 4 hr, no facial massage x 24 hr, avoid strenuous exercise x 24 hr. Onset 3-7 days, peak 2 weeks, duration 3-4 months.","post_assessment":"Tolerated well. No immediate AEs. Follow up 2 weeks prn."}', 10);

