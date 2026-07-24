
-- Unified per-staff message templates (one row per (staff, message_type))
CREATE TABLE public.staff_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  message_type text NOT NULL,            -- 'checkin' | 'review' | 'rebook' | 'photo' | future cadences
  enabled boolean NOT NULL DEFAULT false,
  template text,
  delay_minutes integer,                 -- normalized delay; null = immediate / N/A
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, message_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_message_templates TO authenticated;
GRANT ALL ON public.staff_message_templates TO service_role;

ALTER TABLE public.staff_message_templates ENABLE ROW LEVEL SECURITY;

-- Staff can read/write their own row; admins can manage all.
CREATE POLICY "staff can read own message templates"
  ON public.staff_message_templates FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid())
  );

CREATE POLICY "staff can upsert own message templates"
  ON public.staff_message_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid())
  );

CREATE POLICY "staff can update own message templates"
  ON public.staff_message_templates FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid())
  );

CREATE POLICY "admins can delete message templates"
  ON public.staff_message_templates FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_staff_message_templates_touch
  BEFORE UPDATE ON public.staff_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill from existing per-cadence columns on staff_profiles.
INSERT INTO public.staff_message_templates (staff_id, message_type, enabled, template, delay_minutes)
SELECT id, 'checkin', COALESCE(checkin_sms_enabled, true), checkin_sms_template, NULL
FROM public.staff_profiles
ON CONFLICT (staff_id, message_type) DO NOTHING;

INSERT INTO public.staff_message_templates (staff_id, message_type, enabled, template, delay_minutes)
SELECT id, 'review', COALESCE(review_sms_enabled, true), review_sms_template,
       COALESCE(review_sms_delay_hours, 48) * 60
FROM public.staff_profiles
ON CONFLICT (staff_id, message_type) DO NOTHING;

INSERT INTO public.staff_message_templates (staff_id, message_type, enabled, template, delay_minutes)
SELECT id, 'rebook', COALESCE(rebook_sms_enabled, false), rebook_sms_template,
       COALESCE(rebook_sms_weeks, 4) * 7 * 24 * 60
FROM public.staff_profiles
ON CONFLICT (staff_id, message_type) DO NOTHING;

-- Drop legacy per-cadence columns now that data is moved.
ALTER TABLE public.staff_profiles
  DROP COLUMN IF EXISTS checkin_sms_enabled,
  DROP COLUMN IF EXISTS checkin_sms_template,
  DROP COLUMN IF EXISTS review_sms_enabled,
  DROP COLUMN IF EXISTS review_sms_template,
  DROP COLUMN IF EXISTS review_sms_delay_hours,
  DROP COLUMN IF EXISTS rebook_sms_enabled,
  DROP COLUMN IF EXISTS rebook_sms_template,
  DROP COLUMN IF EXISTS rebook_sms_weeks;
