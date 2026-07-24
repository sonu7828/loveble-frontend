
-- ============================================================
-- 1. DEVICE PRESETS
-- ============================================================
CREATE TABLE public.device_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text NOT NULL,
  treatment_type text NOT NULL,
  fitzpatrick text,
  depth_mm numeric,
  energy numeric,
  energy_unit text,
  passes integer,
  pulse_ms numeric,
  pulse_hz numeric,
  spot_size_mm numeric,
  cooling text,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_presets TO authenticated;
GRANT ALL ON public.device_presets TO service_role;
ALTER TABLE public.device_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff read device presets" ON public.device_presets
  FOR SELECT TO authenticated USING (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clinical staff manage device presets" ON public.device_presets
  FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE TRIGGER device_presets_touch BEFORE UPDATE ON public.device_presets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX device_presets_device_idx ON public.device_presets(device_name, fitzpatrick) WHERE is_archived = false;

-- Extend energy notes with structured device fields
ALTER TABLE public.clinical_note_energy
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS fitzpatrick text,
  ADD COLUMN IF NOT EXISTS depth_mm numeric,
  ADD COLUMN IF NOT EXISTS energy numeric,
  ADD COLUMN IF NOT EXISTS energy_unit text,
  ADD COLUMN IF NOT EXISTS passes integer,
  ADD COLUMN IF NOT EXISTS pulse_ms numeric,
  ADD COLUMN IF NOT EXISTS pulse_hz numeric,
  ADD COLUMN IF NOT EXISTS spot_size_mm numeric,
  ADD COLUMN IF NOT EXISTS cooling text,
  ADD COLUMN IF NOT EXISTS preset_id uuid REFERENCES public.device_presets(id) ON DELETE SET NULL;

-- ============================================================
-- 2. TOX DOSING GUARDRAILS
-- ============================================================
CREATE TABLE public.tox_zone_guardrails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  zone text NOT NULL,
  min_units numeric NOT NULL,
  typical_units numeric NOT NULL,
  max_units numeric NOT NULL,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product, zone)
);
GRANT SELECT ON public.tox_zone_guardrails TO authenticated;
GRANT ALL ON public.tox_zone_guardrails TO service_role;
ALTER TABLE public.tox_zone_guardrails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read guardrails" ON public.tox_zone_guardrails
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage guardrails" ON public.tox_zone_guardrails
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed Botox guardrails (industry-standard units)
INSERT INTO public.tox_zone_guardrails(product, zone, min_units, typical_units, max_units) VALUES
  ('Botox','Glabella',16,20,30),
  ('Botox','Hairline (frontal)',6,10,20),
  ('Botox','Frontalis',6,12,20),
  ('Botox','Crow''s feet (L)',8,12,15),
  ('Botox','Crow''s feet (R)',8,12,15),
  ('Botox','Bunny lines (nasalis)',2,4,8),
  ('Botox','Nasal tip (droopy tip)',2,2,4),
  ('Botox','Nostril flare (dilator naris)',2,4,6),
  ('Botox','Brow lift',2,4,8),
  ('Botox','Lip flip',2,4,6),
  ('Botox','Gummy smile',2,4,6),
  ('Botox','DAO',2,4,8),
  ('Botox','Mentalis (chin)',4,6,10),
  ('Botox','Pebble chin',2,4,8),
  ('Botox','Masseter (L)',20,25,40),
  ('Botox','Masseter (R)',20,25,40),
  ('Botox','Nefertiti lift (jawline)',10,20,40),
  ('Botox','Platysma (neck bands)',20,40,80),
  ('Botox','Trapezius',40,60,100),
  ('Botox','Hyperhidrosis (axilla)',50,75,100),
  ('Botox','Hyperhidrosis (palms)',50,75,100),
  ('Botox','Hyperhidrosis (scalp)',60,100,200)
ON CONFLICT (product, zone) DO NOTHING;

-- Dysport ~ 2.5x Botox
INSERT INTO public.tox_zone_guardrails(product, zone, min_units, typical_units, max_units)
SELECT 'Dysport', zone, min_units*2.5, typical_units*2.5, max_units*2.5
FROM public.tox_zone_guardrails WHERE product='Botox'
ON CONFLICT (product, zone) DO NOTHING;

-- Xeomin ~ 1:1 Botox
INSERT INTO public.tox_zone_guardrails(product, zone, min_units, typical_units, max_units)
SELECT 'Xeomin', zone, min_units, typical_units, max_units
FROM public.tox_zone_guardrails WHERE product='Botox'
ON CONFLICT (product, zone) DO NOTHING;

-- Jeuveau ~ 1:1 Botox
INSERT INTO public.tox_zone_guardrails(product, zone, min_units, typical_units, max_units)
SELECT 'Jeuveau', zone, min_units, typical_units, max_units
FROM public.tox_zone_guardrails WHERE product='Botox'
ON CONFLICT (product, zone) DO NOTHING;

-- Daxxify ~ 1:1 Botox
INSERT INTO public.tox_zone_guardrails(product, zone, min_units, typical_units, max_units)
SELECT 'Daxxify', zone, min_units, typical_units, max_units
FROM public.tox_zone_guardrails WHERE product='Botox'
ON CONFLICT (product, zone) DO NOTHING;

-- Lifetime tox view
CREATE OR REPLACE VIEW public.client_tox_lifetime AS
SELECT
  lower(n.client_email) AS client_email,
  t.product,
  SUM(t.total_units)::numeric AS lifetime_units,
  SUM(CASE WHEN n.signed_at >= now() - interval '365 days' THEN t.total_units ELSE 0 END)::numeric AS units_last_12mo,
  MAX(n.signed_at) AS last_visit_at,
  COUNT(*)::int AS visit_count
FROM public.clinical_note_neurotoxin t
JOIN public.clinical_notes n ON n.id = t.clinical_note_id
WHERE n.status IN ('signed','cosigned','locked')
GROUP BY lower(n.client_email), t.product;
GRANT SELECT ON public.client_tox_lifetime TO authenticated;

-- ============================================================
-- 3. FILLER REGION LOG (per-region mL detail)
-- ============================================================
CREATE TABLE public.filler_region_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  region text NOT NULL,
  product text NOT NULL,
  lot_id uuid REFERENCES public.product_lots(id) ON DELETE SET NULL,
  volume_ml numeric NOT NULL CHECK (volume_ml > 0),
  cannula_or_needle text,
  depth text,
  technique text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filler_region_log TO authenticated;
GRANT ALL ON public.filler_region_log TO service_role;
ALTER TABLE public.filler_region_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage filler region log" ON public.filler_region_log
  FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clients view own filler regions" ON public.filler_region_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinical_notes n
    WHERE n.id = filler_region_log.clinical_note_id
      AND public.current_client_email() IS NOT NULL
      AND lower(n.client_email) = public.current_client_email()
      AND n.status IN ('signed','cosigned','locked')
  ));
CREATE INDEX filler_region_log_note_idx ON public.filler_region_log(clinical_note_id);
CREATE TRIGGER protect_filler_region BEFORE UPDATE OR DELETE ON public.filler_region_log
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_detail_row();

-- ============================================================
-- 4. ADVERSE EVENTS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.adverse_event_type AS ENUM (
    'bruising','swelling','nodule','granuloma','infection','tyndall',
    'asymmetry','ptosis','headache','vascular_occlusion','necrosis',
    'anaphylaxis','allergic_reaction','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.adverse_event_severity AS ENUM ('mild','moderate','severe','life_threatening');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.adverse_event_outcome AS ENUM ('ongoing','improving','resolved','referred','er_sent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.adverse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  client_first_name text,
  client_last_name text,
  clinical_note_id uuid REFERENCES public.clinical_notes(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  event_date timestamptz NOT NULL DEFAULT now(),
  event_type public.adverse_event_type NOT NULL,
  severity public.adverse_event_severity NOT NULL,
  body_region text,
  product_involved text,
  lot_id uuid REFERENCES public.product_lots(id) ON DELETE SET NULL,
  intervention text,
  medications_given text[] NOT NULL DEFAULT '{}',
  outcome public.adverse_event_outcome NOT NULL DEFAULT 'ongoing',
  followup_at timestamptz,
  followup_complete boolean NOT NULL DEFAULT false,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  np_notified_at timestamptz,
  np_notified_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  photos text[] NOT NULL DEFAULT '{}',
  notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adverse_events TO authenticated;
GRANT ALL ON public.adverse_events TO service_role;
ALTER TABLE public.adverse_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage AE" ON public.adverse_events
  FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE INDEX ae_client_idx ON public.adverse_events(lower(client_email), event_date DESC);
CREATE INDEX ae_followup_idx ON public.adverse_events(followup_at) WHERE followup_complete = false AND followup_at IS NOT NULL;
CREATE TRIGGER ae_touch BEFORE UPDATE ON public.adverse_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 5. VO PROTOCOL
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.vo_protocol_status AS ENUM ('active','resolved','escalated','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.vo_protocol_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  client_first_name text,
  client_last_name text,
  ae_id uuid REFERENCES public.adverse_events(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  onset_at timestamptz,
  resolved_at timestamptz,
  status public.vo_protocol_status NOT NULL DEFAULT 'active',
  lead_np_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_suspected text,
  region text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vo_protocol_runs TO authenticated;
GRANT ALL ON public.vo_protocol_runs TO service_role;
ALTER TABLE public.vo_protocol_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage VO runs" ON public.vo_protocol_runs
  FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE INDEX vo_runs_active_idx ON public.vo_protocol_runs(status, started_at DESC);
CREATE TRIGGER vo_runs_touch BEFORE UPDATE ON public.vo_protocol_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.vo_protocol_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.vo_protocol_runs(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  step_label text NOT NULL,
  due_offset_minutes integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vo_protocol_steps TO authenticated;
GRANT ALL ON public.vo_protocol_steps TO service_role;
ALTER TABLE public.vo_protocol_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff manage VO steps" ON public.vo_protocol_steps
  FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE INDEX vo_steps_run_idx ON public.vo_protocol_steps(run_id, sort_order);
