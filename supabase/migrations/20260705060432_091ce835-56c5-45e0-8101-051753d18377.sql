
CREATE TABLE public.checkout_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_email text,
  created_by uuid REFERENCES auth.users(id),
  created_by_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_discount_reason text,
  suggested_discount_pct numeric,
  suggested_discount_amount_cents integer,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed')),
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX checkout_proposals_one_pending_per_appt
  ON public.checkout_proposals(appointment_id)
  WHERE status = 'pending' AND appointment_id IS NOT NULL;

CREATE INDEX checkout_proposals_email_idx ON public.checkout_proposals(client_email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkout_proposals TO authenticated;
GRANT ALL ON public.checkout_proposals TO service_role;

ALTER TABLE public.checkout_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view proposals"
  ON public.checkout_proposals FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()) OR public.is_clinical_staff(auth.uid()));

CREATE POLICY "Staff can create proposals"
  ON public.checkout_proposals FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()) OR public.is_clinical_staff(auth.uid()));

CREATE POLICY "Staff can update proposals"
  ON public.checkout_proposals FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()) OR public.is_clinical_staff(auth.uid()));

CREATE POLICY "Staff can delete proposals"
  ON public.checkout_proposals FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER checkout_proposals_touch_updated_at
  BEFORE UPDATE ON public.checkout_proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS discount_presets jsonb NOT NULL DEFAULT
    '{"friend":10,"review_dollars":25,"healthcare":15,"new_client":10,"birthday":10,"referral_dollars":25}'::jsonb;
