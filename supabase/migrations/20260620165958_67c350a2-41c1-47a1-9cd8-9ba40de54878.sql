
-- Rewards: points ledger + settings + earn/redeem/expire functions
-- Earn: 1 pt per $10 service subtotal. Redeem: 1 pt = $0.10. 50% cap. 12-mo inactivity expiry.

CREATE TABLE IF NOT EXISTS public.client_points_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  earn_dollars_per_point integer NOT NULL DEFAULT 10,        -- $10 = 1 pt
  point_value_cents integer NOT NULL DEFAULT 10,             -- 1 pt = 10c
  max_redemption_pct integer NOT NULL DEFAULT 50,            -- max 50% of bill
  inactivity_expiry_months integer NOT NULL DEFAULT 12,
  block_promo_combo boolean NOT NULL DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.client_points_settings TO authenticated, anon;
GRANT ALL ON public.client_points_settings TO service_role;
ALTER TABLE public.client_points_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable to all" ON public.client_points_settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.client_points_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.client_points_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.client_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  delta integer NOT NULL,                                    -- positive=earn, negative=redeem/expire
  reason text NOT NULL CHECK (reason IN ('earned','redeemed','expired','admin_adjust','refund_reversal')),
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpl_email ON public.client_points_ledger (lower(client_email));
CREATE INDEX IF NOT EXISTS idx_cpl_sale ON public.client_points_ledger (sale_id);
CREATE INDEX IF NOT EXISTS idx_cpl_created ON public.client_points_ledger (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cpl_one_earn_per_sale
  ON public.client_points_ledger (sale_id, reason)
  WHERE sale_id IS NOT NULL AND reason IN ('earned','redeemed');

GRANT SELECT ON public.client_points_ledger TO authenticated;
GRANT ALL ON public.client_points_ledger TO service_role;
ALTER TABLE public.client_points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger clinical staff read" ON public.client_points_ledger FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));
CREATE POLICY "ledger client reads own" ON public.client_points_ledger FOR SELECT TO authenticated
  USING (lower(client_email) = public.current_client_email());
CREATE POLICY "ledger admin manage" ON public.client_points_ledger FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Balance helper
CREATE OR REPLACE FUNCTION public.get_points_balance(_client_email text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(delta), 0)::int FROM public.client_points_ledger
   WHERE lower(client_email) = lower(coalesce(_client_email,''))
$$;
GRANT EXECUTE ON FUNCTION public.get_points_balance(text) TO authenticated, anon;

-- View for balances + last activity
CREATE OR REPLACE VIEW public.client_points_balances AS
  SELECT lower(client_email) AS client_email,
         COALESCE(SUM(delta), 0)::int AS balance,
         MAX(created_at) AS last_activity_at
    FROM public.client_points_ledger
   GROUP BY lower(client_email);
GRANT SELECT ON public.client_points_balances TO authenticated;

-- Auto-earn + redeem on sale paid
CREATE OR REPLACE FUNCTION public.apply_points_on_sale_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.client_points_settings;
  v_service_subtotal int;
  v_earned int;
  v_redeem int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;
  IF OLD.status = 'paid' THEN RETURN NEW; END IF;  -- only on transition
  IF NEW.client_email IS NULL OR length(trim(NEW.client_email)) = 0 THEN RETURN NEW; END IF;

  SELECT * INTO v_settings FROM public.client_points_settings WHERE id = true;
  IF NOT FOUND OR NOT v_settings.is_enabled THEN RETURN NEW; END IF;

  -- Earn from service subtotal (services/units/packages/addons/custom)
  SELECT COALESCE(SUM(line_total_cents), 0) INTO v_service_subtotal
    FROM public.sale_items
   WHERE sale_id = NEW.id
     AND kind IN ('service','unit_service','package','service_addon','custom');

  v_earned := floor(v_service_subtotal::numeric / (v_settings.earn_dollars_per_point * 100));
  IF v_earned > 0 THEN
    INSERT INTO public.client_points_ledger (client_email, delta, reason, sale_id, notes)
      VALUES (lower(NEW.client_email), v_earned, 'earned', NEW.id,
              'Auto-earned from sale ($' || (v_service_subtotal/100.0)::text || ' service subtotal)')
      ON CONFLICT (sale_id, reason) WHERE sale_id IS NOT NULL AND reason IN ('earned','redeemed') DO NOTHING;
  END IF;

  -- Redeem: pulled from sales.points_redeemed (set at checkout time)
  v_redeem := COALESCE(NEW.points_redeemed, 0);
  IF v_redeem > 0 THEN
    INSERT INTO public.client_points_ledger (client_email, delta, reason, sale_id, notes)
      VALUES (lower(NEW.client_email), -v_redeem, 'redeemed', NEW.id,
              v_redeem || ' pts redeemed (−$' || (v_redeem * v_settings.point_value_cents / 100.0)::text || ')')
      ON CONFLICT (sale_id, reason) WHERE sale_id IS NOT NULL AND reason IN ('earned','redeemed') DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

-- points_redeemed column on sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS points_redeemed integer NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS trg_apply_points_on_sale_paid ON public.sales;
CREATE TRIGGER trg_apply_points_on_sale_paid
  AFTER UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.apply_points_on_sale_paid();

-- Refund reversal: when refund full amount, reverse earned pts (best-effort)
CREATE OR REPLACE FUNCTION public.reverse_points_on_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_earned int;
BEGIN
  IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
    SELECT COALESCE(SUM(delta), 0) INTO v_earned
      FROM public.client_points_ledger
     WHERE sale_id = NEW.id AND reason = 'earned';
    IF v_earned > 0 THEN
      INSERT INTO public.client_points_ledger (client_email, delta, reason, sale_id, notes)
        VALUES (lower(NEW.client_email), -v_earned, 'refund_reversal', NEW.id, 'Refund: reversed earned points');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reverse_points_on_refund ON public.sales;
CREATE TRIGGER trg_reverse_points_on_refund
  AFTER UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.reverse_points_on_refund();

-- Admin adjust
CREATE OR REPLACE FUNCTION public.adjust_points(_client_email text, _delta int, _reason text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _delta = 0 THEN RAISE EXCEPTION 'Delta must be non-zero'; END IF;
  INSERT INTO public.client_points_ledger (client_email, delta, reason, notes, created_by)
    VALUES (lower(_client_email), _delta, 'admin_adjust', _reason, auth.uid());
  SELECT public.get_points_balance(_client_email) INTO v_new;
  RETURN v_new;
END $$;
GRANT EXECUTE ON FUNCTION public.adjust_points(text,int,text) TO authenticated;

-- Expiry sweep: any client whose latest activity > N months ago and balance > 0
CREATE OR REPLACE FUNCTION public.expire_stale_points()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.client_points_settings;
  v_count int := 0;
  r record;
BEGIN
  SELECT * INTO v_settings FROM public.client_points_settings WHERE id = true;
  IF NOT FOUND THEN RETURN 0; END IF;
  FOR r IN
    SELECT client_email, balance, last_activity_at
      FROM public.client_points_balances
     WHERE balance > 0
       AND last_activity_at < now() - (v_settings.inactivity_expiry_months || ' months')::interval
  LOOP
    INSERT INTO public.client_points_ledger (client_email, delta, reason, notes)
      VALUES (r.client_email, -r.balance, 'expired',
              r.balance || ' pts expired after ' || v_settings.inactivity_expiry_months || ' mo inactivity');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.expire_stale_points() TO service_role;
