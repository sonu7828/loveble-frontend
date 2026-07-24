-- 1. Break-glass reason on PHI access log
ALTER TABLE public.phi_access_log
  ADD COLUMN IF NOT EXISTS break_glass_reason text;

-- 2. Outcomes summary function (clinical staff only)
CREATE OR REPLACE FUNCTION public.get_outcomes_summary(
  _from timestamptz DEFAULT (now() - interval '180 days'),
  _to   timestamptz DEFAULT now(),
  _location_id uuid DEFAULT NULL,
  _staff_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_clinical_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH notes AS (
    SELECT n.id, n.appointment_id, n.category, n.provider_user_id, n.provider_name,
           n.signed_at, n.location_id, n.photo_post_paths,
           COALESCE(f.product, t.product, e.device) AS product
    FROM public.clinical_notes n
    LEFT JOIN public.clinical_note_filler f ON f.clinical_note_id = n.id
    LEFT JOIN public.clinical_note_neurotoxin t ON t.clinical_note_id = n.id
    LEFT JOIN public.clinical_note_energy e ON e.clinical_note_id = n.id
    WHERE n.status IN ('signed','cosigned','locked')
      AND n.signed_at BETWEEN _from AND _to
      AND (_location_id IS NULL OR n.location_id = _location_id)
      AND (_staff_user_id IS NULL OR n.provider_user_id = _staff_user_id)
  ),
  ae_by_appt AS (
    SELECT DISTINCT appointment_id
    FROM public.adverse_events
    WHERE appointment_id IS NOT NULL
      AND severity IN ('moderate','severe')
  ),
  ae_by_injector AS (
    SELECT n.provider_user_id,
           MAX(n.provider_name) AS provider_name,
           COUNT(*)::int AS visits,
           COUNT(ae.appointment_id)::int AS ae_count
    FROM notes n
    LEFT JOIN ae_by_appt ae ON ae.appointment_id = n.appointment_id
    GROUP BY n.provider_user_id
    HAVING COUNT(*) >= 1
  ),
  ae_by_product AS (
    SELECT n.product,
           COUNT(*)::int AS visits,
           COUNT(ae.appointment_id)::int AS ae_count
    FROM notes n
    LEFT JOIN ae_by_appt ae ON ae.appointment_id = n.appointment_id
    WHERE n.product IS NOT NULL
    GROUP BY n.product
  ),
  recovery AS (
    SELECT n.product, p.day_offset,
           ROUND(AVG(p.swelling)::numeric, 2) AS avg_swelling,
           ROUND(AVG(p.bruising)::numeric, 2) AS avg_bruising,
           ROUND(AVG(p.pain)::numeric, 2)     AS avg_pain,
           COUNT(*)::int                      AS n
    FROM notes n
    JOIN public.postop_checkins p ON p.appointment_id = n.appointment_id
    WHERE n.product IS NOT NULL
    GROUP BY n.product, p.day_offset
  ),
  photo_share AS (
    SELECT COUNT(*) FILTER (WHERE array_length(photo_post_paths,1) > 0)::int AS with_photos,
           COUNT(*)::int AS total
    FROM notes
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', _from, 'to', _to),
    'totals', jsonb_build_object('notes', (SELECT COUNT(*) FROM notes)),
    'ae_by_injector', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'provider_user_id', provider_user_id,
        'provider_name', provider_name,
        'visits', visits,
        'ae_count', ae_count,
        'ae_rate_pct', ROUND((ae_count::numeric / NULLIF(visits,0)) * 100, 2)
      ) ORDER BY visits DESC) FROM ae_by_injector), '[]'::jsonb),
    'ae_by_product', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'product', product, 'visits', visits, 'ae_count', ae_count,
        'ae_rate_pct', ROUND((ae_count::numeric / NULLIF(visits,0)) * 100, 2)
      ) ORDER BY visits DESC) FROM ae_by_product), '[]'::jsonb),
    'recovery_by_product', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'product', product, 'day_offset', day_offset,
        'avg_swelling', avg_swelling, 'avg_bruising', avg_bruising,
        'avg_pain', avg_pain, 'n', n
      ) ORDER BY product, day_offset) FROM recovery), '[]'::jsonb),
    'photo_share', (SELECT to_jsonb(photo_share) FROM photo_share)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_outcomes_summary(timestamptz, timestamptz, uuid, uuid) TO authenticated;

-- 3. PROM instruments
CREATE TABLE public.prom_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL,                    -- 'injectable' | 'skin' | 'general'
  questions jsonb NOT NULL,                  -- [{id, text, scale: '0-4'|'0-3'|'1-5', reverse?: bool}]
  scoring_method text NOT NULL DEFAULT 'raw_normalized', -- 'raw_normalized' | 'rasch_lookup'
  scoring_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  default_offset_days int,                   -- when to surface after appt (e.g. 28, 84)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prom_instruments TO authenticated, anon;
GRANT ALL ON public.prom_instruments TO service_role;

ALTER TABLE public.prom_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active instruments"
  ON public.prom_instruments FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage instruments"
  ON public.prom_instruments FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_prom_instruments_touch
  BEFORE UPDATE ON public.prom_instruments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. PROM responses
CREATE TABLE public.prom_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES public.prom_instruments(id) ON DELETE RESTRICT,
  instrument_key text NOT NULL,
  client_email text NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  clinical_note_id uuid REFERENCES public.clinical_notes(id) ON DELETE SET NULL,
  timepoint text,                            -- 'baseline' | '4wk' | '12wk' | 'adhoc'
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_score numeric,
  normalized_score numeric,                  -- 0-100
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prom_responses_client_idx
  ON public.prom_responses (lower(client_email), completed_at DESC);
CREATE INDEX prom_responses_appt_idx
  ON public.prom_responses (appointment_id);
CREATE INDEX prom_responses_instrument_idx
  ON public.prom_responses (instrument_key, completed_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.prom_responses TO authenticated;
GRANT ALL ON public.prom_responses TO service_role;

ALTER TABLE public.prom_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own PROM responses"
  ON public.prom_responses FOR ALL
  USING (lower(client_email) = public.current_client_email())
  WITH CHECK (lower(client_email) = public.current_client_email());

CREATE POLICY "Clinical staff read all PROM responses"
  ON public.prom_responses FOR SELECT
  USING (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff manage PROM responses"
  ON public.prom_responses FOR ALL
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));

CREATE TRIGGER trg_prom_responses_touch
  BEFORE UPDATE ON public.prom_responses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();