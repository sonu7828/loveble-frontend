CREATE TABLE IF NOT EXISTS public.staff_pay_config (
  staff_id uuid PRIMARY KEY REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  hourly_rate_cents integer,
  commission_percent numeric(5,2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.staff_pay_config (staff_id, hourly_rate_cents, commission_percent)
SELECT id, hourly_rate_cents, commission_percent
  FROM public.staff_profiles
 WHERE hourly_rate_cents IS NOT NULL OR commission_percent IS NOT NULL
ON CONFLICT (staff_id) DO NOTHING;

ALTER TABLE public.staff_profiles
  DROP COLUMN IF EXISTS hourly_rate_cents,
  DROP COLUMN IF EXISTS commission_percent;

ALTER TABLE public.staff_pay_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all pay"
  ON public.staff_pay_config
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Staff view own pay"
  ON public.staff_pay_config
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_profiles sp
    WHERE sp.id = staff_pay_config.staff_id AND sp.user_id = auth.uid()
  ));

CREATE TRIGGER staff_pay_config_touch
BEFORE UPDATE ON public.staff_pay_config
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();