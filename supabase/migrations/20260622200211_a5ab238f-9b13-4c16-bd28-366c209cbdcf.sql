CREATE OR REPLACE FUNCTION public.apply_points_on_sale_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.client_points_settings;
  v_paid_cents int;
  v_earned int;
  v_redeem int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;
  IF OLD.status = 'paid' THEN RETURN NEW; END IF;
  IF NEW.client_email IS NULL OR length(trim(NEW.client_email)) = 0 THEN RETURN NEW; END IF;

  BEGIN
    SELECT * INTO v_settings FROM public.client_points_settings WHERE id = true;
    IF NOT FOUND OR NOT v_settings.is_enabled THEN RETURN NEW; END IF;

    -- Earn points ONLY on the amount the client actually paid (cash/card),
    -- excluding vouchers, credits, unit bank, and redeemed points value.
    -- total_cents already nets out discounts/vouchers/credits and equals
    -- the amount charged to the client.
    v_paid_cents := GREATEST(COALESCE(NEW.total_cents, 0), 0);

    v_earned := floor(v_paid_cents::numeric / (v_settings.earn_dollars_per_point * 100));
    IF v_earned > 0 AND NOT EXISTS (
      SELECT 1 FROM public.client_points_ledger WHERE sale_id = NEW.id AND reason = 'earned'
    ) THEN
      INSERT INTO public.client_points_ledger (client_email, delta, reason, sale_id, notes)
        VALUES (lower(NEW.client_email), v_earned, 'earned', NEW.id,
                'Auto-earned from sale ($' || (v_paid_cents/100.0)::text || ' paid)');
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
    RAISE WARNING 'apply_points_on_sale_paid failed for sale %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END $function$;