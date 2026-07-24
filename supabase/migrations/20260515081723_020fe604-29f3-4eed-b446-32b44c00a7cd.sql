CREATE OR REPLACE FUNCTION public.redeem_voucher(_voucher_id uuid, _sale_id uuid, _amount_cents integer, _redeemed_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance integer;
  v_active boolean;
  v_expires timestamptz;
  v_redemption_id uuid;
  v_new_balance integer;
BEGIN
  IF NOT (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT balance_cents, is_active, expires_at
    INTO v_balance, v_active, v_expires
    FROM public.vouchers WHERE id = _voucher_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher not found'; END IF;
  IF NOT v_active THEN RAISE EXCEPTION 'Voucher inactive or already redeemed'; END IF;
  IF v_expires IS NOT NULL AND v_expires < now() THEN RAISE EXCEPTION 'Voucher expired'; END IF;
  IF v_balance < _amount_cents THEN RAISE EXCEPTION 'Insufficient voucher balance: % cents available', v_balance; END IF;

  v_new_balance := v_balance - _amount_cents;

  UPDATE public.vouchers
     SET balance_cents = v_new_balance,
         is_active = CASE WHEN v_new_balance <= 0 THEN false ELSE is_active END
   WHERE id = _voucher_id;

  INSERT INTO public.voucher_redemptions (voucher_id, sale_id, amount_cents, redeemed_by)
    VALUES (_voucher_id, _sale_id, _amount_cents, _redeemed_by)
    RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object('redemption_id', v_redemption_id, 'remaining_balance_cents', v_new_balance);
END;
$function$;