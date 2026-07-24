
-- Fix: 'service_addon' is not a valid sale_item_kind enum value. Valid service-like kinds are
-- 'service', 'unit_service', 'package', and 'custom'. The bad value caused every paid sale to
-- throw inside the trigger, get swallowed by EXCEPTION WHEN OTHERS, and award zero points.
CREATE OR REPLACE FUNCTION public.apply_points_on_sale_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       AND kind IN ('service','unit_service','package','custom');

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
    RAISE WARNING 'apply_points_on_sale_paid failed for sale %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END $function$;

-- Backfill: award missed "earned" points for paid sales in the last 60 days that have no
-- earned-ledger row yet. Uses the same formula as the trigger.
DO $backfill$
DECLARE
  v_settings public.client_points_settings;
  r record;
  v_subtotal int;
  v_earned int;
BEGIN
  SELECT * INTO v_settings FROM public.client_points_settings WHERE id = true;
  IF NOT FOUND OR NOT v_settings.is_enabled THEN RETURN; END IF;

  FOR r IN
    SELECT s.id, s.client_email, s.points_redeemed
      FROM public.sales s
     WHERE s.status = 'paid'
       AND s.paid_at > now() - interval '60 days'
       AND s.client_email IS NOT NULL
       AND length(trim(s.client_email)) > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.client_points_ledger l
          WHERE l.sale_id = s.id AND l.reason = 'earned'
       )
  LOOP
    SELECT COALESCE(SUM(line_total_cents), 0) INTO v_subtotal
      FROM public.sale_items
     WHERE sale_id = r.id
       AND kind IN ('service','unit_service','package','custom');

    v_earned := floor(v_subtotal::numeric / (v_settings.earn_dollars_per_point * 100));
    IF v_earned > 0 THEN
      INSERT INTO public.client_points_ledger (client_email, delta, reason, sale_id, notes)
        VALUES (lower(r.client_email), v_earned, 'earned', r.id,
                'Backfill: missed auto-earn from sale ($' || (v_subtotal/100.0)::text || ' service subtotal)');
    END IF;

    IF COALESCE(r.points_redeemed, 0) > 0 AND NOT EXISTS (
      SELECT 1 FROM public.client_points_ledger WHERE sale_id = r.id AND reason = 'redeemed'
    ) THEN
      INSERT INTO public.client_points_ledger (client_email, delta, reason, sale_id, notes)
        VALUES (lower(r.client_email), -r.points_redeemed, 'redeemed', r.id,
                'Backfill: ' || r.points_redeemed || ' pts redeemed');
    END IF;
  END LOOP;
END $backfill$;
