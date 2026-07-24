
CREATE OR REPLACE FUNCTION public.apply_points_on_sale_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.client_points_settings;
  v_service_subtotal int;
  v_earned int;
  v_redeem int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;
  IF OLD.status = 'paid' THEN RETURN NEW; END IF;
  IF NEW.client_email IS NULL OR length(trim(NEW.client_email)) = 0 THEN RETURN NEW; END IF;

  BEGIN
    SELECT * INTO v_settings FROM public.client_points_settings WHERE id = true;
    IF NOT FOUND OR NOT v_settings.is_enabled THEN RETURN NEW; END IF;

    SELECT COALESCE(SUM(line_total_cents), 0) INTO v_service_subtotal
      FROM public.sale_items
     WHERE sale_id = NEW.id
       AND kind IN ('service','unit_service','package','service_addon','custom');

    v_earned := floor(v_service_subtotal::numeric / (v_settings.earn_dollars_per_point * 100));
    IF v_earned > 0 AND NOT EXISTS (
      SELECT 1 FROM public.client_points_ledger WHERE sale_id = NEW.id AND reason = 'earned'
    ) THEN
      INSERT INTO public.client_points_ledger (client_email, delta, reason, sale_id, notes)
        VALUES (lower(NEW.client_email), v_earned, 'earned', NEW.id,
                'Auto-earned from sale ($' || (v_service_subtotal/100.0)::text || ' service subtotal)');
    END IF;

    v_redeem := COALESCE(NEW.points_redeemed, 0);
    IF v_redeem > 0 AND NOT EXISTS (
      SELECT 1 FROM public.client_points_ledger WHERE sale_id = NEW.id AND reason = 'redeemed'
    ) THEN
      INSERT INTO public.client_points_ledger (client_email, delta, reason, sale_id, notes)
        VALUES (lower(NEW.client_email), -v_redeem, 'redeemed', NEW.id,
                v_redeem || ' pts redeemed (-$' || (v_redeem * v_settings.point_value_cents / 100.0)::text || ')');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block a sale from being marked paid because of rewards bookkeeping.
    RAISE WARNING 'apply_points_on_sale_paid failed for sale %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_points_on_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_earned int;
BEGIN
  IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
    BEGIN
      SELECT COALESCE(SUM(delta), 0) INTO v_earned
        FROM public.client_points_ledger
       WHERE sale_id = NEW.id AND reason = 'earned';
      IF v_earned > 0 THEN
        INSERT INTO public.client_points_ledger (client_email, delta, reason, sale_id, notes)
          VALUES (lower(NEW.client_email), -v_earned, 'refund_reversal', NEW.id, 'Refund: reversed earned points');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reverse_points_on_refund failed for sale %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

-- Recover the stuck cash sale so the user can move on.
UPDATE public.sales SET status='paid', paid_at=COALESCE(paid_at, now())
 WHERE id='02d854f6-db7e-4b98-8717-411e58fb8186' AND status='pending_payment' AND payment_method='cash';
