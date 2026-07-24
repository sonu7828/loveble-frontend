
-- Templates
CREATE TABLE public.treatment_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  total_sessions integer NOT NULL CHECK (total_sessions > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  validity_days integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.treatment_plan_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plan_templates TO authenticated;
GRANT ALL ON public.treatment_plan_templates TO service_role;
ALTER TABLE public.treatment_plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view active templates" ON public.treatment_plan_templates FOR SELECT USING (is_active OR public.is_clinical_staff(auth.uid()));
CREATE POLICY "Admins manage templates" ON public.treatment_plan_templates FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_tpt_updated BEFORE UPDATE ON public.treatment_plan_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Client plans
CREATE TABLE public.client_treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  template_id uuid REFERENCES public.treatment_plan_templates(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  name text NOT NULL,
  total_sessions integer NOT NULL CHECK (total_sessions > 0),
  sessions_used integer NOT NULL DEFAULT 0 CHECK (sessions_used >= 0),
  price_cents integer NOT NULL DEFAULT 0,
  purchase_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired','refunded')),
  refunded_at timestamptz,
  refund_reason text,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_tx_plans_email_idx ON public.client_treatment_plans (lower(client_email));
CREATE INDEX client_tx_plans_status_idx ON public.client_treatment_plans (status) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_treatment_plans TO authenticated;
GRANT ALL ON public.client_treatment_plans TO service_role;
ALTER TABLE public.client_treatment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read client plans" ON public.client_treatment_plans FOR SELECT TO authenticated USING (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Clients read own plans" ON public.client_treatment_plans FOR SELECT TO authenticated USING (lower(client_email) = lower(coalesce(auth.jwt() ->> 'email','')));
CREATE POLICY "Scheduler/admin manage plans" ON public.client_treatment_plans FOR ALL TO authenticated USING (public.is_scheduler_or_admin(auth.uid())) WITH CHECK (public.is_scheduler_or_admin(auth.uid()));
CREATE TRIGGER trg_ctp_updated BEFORE UPDATE ON public.client_treatment_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Redemptions ledger
CREATE TABLE public.treatment_plan_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.client_treatment_plans(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX tpr_plan_idx ON public.treatment_plan_redemptions (plan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plan_redemptions TO authenticated;
GRANT ALL ON public.treatment_plan_redemptions TO service_role;
ALTER TABLE public.treatment_plan_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read redemptions" ON public.treatment_plan_redemptions FOR SELECT TO authenticated USING (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Clients read own redemptions" ON public.treatment_plan_redemptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.client_treatment_plans p WHERE p.id = plan_id AND lower(p.client_email) = lower(coalesce(auth.jwt() ->> 'email',''))));

-- RPC: purchase
CREATE OR REPLACE FUNCTION public.purchase_treatment_plan(
  _template_id uuid,
  _client_email text,
  _sale_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_tpl public.treatment_plan_templates;
  v_plan_id uuid;
  v_expires timestamptz;
BEGIN
  IF NOT (public.is_scheduler_or_admin(auth.uid()) OR public.is_staff_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_tpl FROM public.treatment_plan_templates WHERE id=_template_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found or inactive'; END IF;
  IF v_tpl.validity_days IS NOT NULL THEN
    v_expires := now() + (v_tpl.validity_days || ' days')::interval;
  END IF;
  INSERT INTO public.client_treatment_plans (
    client_email, template_id, service_id, name, total_sessions, price_cents,
    purchase_sale_id, expires_at, issued_by, notes
  ) VALUES (
    lower(_client_email), v_tpl.id, v_tpl.service_id, v_tpl.name, v_tpl.total_sessions, v_tpl.price_cents,
    _sale_id, v_expires, auth.uid(), _notes
  ) RETURNING id INTO v_plan_id;
  RETURN v_plan_id;
END $$;

-- RPC: redeem session
CREATE OR REPLACE FUNCTION public.redeem_treatment_plan_session(
  _plan_id uuid,
  _appointment_id uuid DEFAULT NULL,
  _sale_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_plan public.client_treatment_plans;
  v_new_used int;
  v_new_status text;
BEGIN
  IF NOT (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_plan FROM public.client_treatment_plans WHERE id=_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF v_plan.status <> 'active' THEN RAISE EXCEPTION 'Plan is %', v_plan.status; END IF;
  IF v_plan.expires_at IS NOT NULL AND v_plan.expires_at < now() THEN
    UPDATE public.client_treatment_plans SET status='expired', updated_at=now() WHERE id=_plan_id;
    RAISE EXCEPTION 'Plan expired';
  END IF;
  IF v_plan.sessions_used >= v_plan.total_sessions THEN
    RAISE EXCEPTION 'No sessions remaining';
  END IF;

  v_new_used := v_plan.sessions_used + 1;
  v_new_status := CASE WHEN v_new_used >= v_plan.total_sessions THEN 'completed' ELSE 'active' END;

  UPDATE public.client_treatment_plans
     SET sessions_used = v_new_used,
         status = v_new_status,
         updated_at = now()
   WHERE id = _plan_id;

  INSERT INTO public.treatment_plan_redemptions (plan_id, appointment_id, sale_id, redeemed_by, notes)
    VALUES (_plan_id, _appointment_id, _sale_id, auth.uid(), _notes);

  RETURN jsonb_build_object('sessions_used', v_new_used, 'sessions_remaining', v_plan.total_sessions - v_new_used, 'status', v_new_status);
END $$;

-- RPC: refund (only if no redemptions)
CREATE OR REPLACE FUNCTION public.refund_treatment_plan(_plan_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_used int;
BEGIN
  IF NOT public.is_scheduler_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT sessions_used INTO v_used FROM public.client_treatment_plans WHERE id=_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF v_used > 0 THEN RAISE EXCEPTION 'Cannot refund: % sessions already used', v_used; END IF;
  UPDATE public.client_treatment_plans
     SET status='refunded', refunded_at=now(), refund_reason=_reason, updated_at=now()
   WHERE id=_plan_id;
END $$;
