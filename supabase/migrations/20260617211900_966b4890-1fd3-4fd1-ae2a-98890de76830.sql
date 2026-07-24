
CREATE TABLE public.staff_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  hours_worked numeric(10,2) NOT NULL DEFAULT 0,
  hourly_rate_cents integer NOT NULL DEFAULT 0,
  hourly_pay_cents integer NOT NULL DEFAULT 0,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  commission_base_cents integer NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  tips_cents integer NOT NULL DEFAULT 0,
  adjustments_cents integer NOT NULL DEFAULT 0,
  adjustment_note text,
  total_cents integer NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'zelle',
  payment_note text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, period_start, period_end)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_payouts TO authenticated;
GRANT ALL ON public.staff_payouts TO service_role;

ALTER TABLE public.staff_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payouts" ON public.staff_payouts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Staff can view own payouts" ON public.staff_payouts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_profiles sp
    WHERE sp.id = staff_payouts.staff_id AND sp.user_id = auth.uid()
  ));

CREATE INDEX idx_staff_payouts_staff_period ON public.staff_payouts(staff_id, period_start DESC);

CREATE TRIGGER trg_staff_payouts_updated
  BEFORE UPDATE ON public.staff_payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
