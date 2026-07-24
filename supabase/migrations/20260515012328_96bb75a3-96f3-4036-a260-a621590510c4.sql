
CREATE OR REPLACE FUNCTION public.redeem_voucher(
  _voucher_id uuid,
  _sale_id uuid,
  _amount_cents integer,
  _redeemed_by uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_active boolean;
  v_expires timestamptz;
  v_redemption_id uuid;
BEGIN
  IF NOT (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT balance_cents, is_active, expires_at
    INTO v_balance, v_active, v_expires
    FROM public.vouchers WHERE id = _voucher_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher not found'; END IF;
  IF NOT v_active THEN RAISE EXCEPTION 'Voucher inactive'; END IF;
  IF v_expires IS NOT NULL AND v_expires < now() THEN RAISE EXCEPTION 'Voucher expired'; END IF;
  IF v_balance < _amount_cents THEN RAISE EXCEPTION 'Insufficient voucher balance: % cents available', v_balance; END IF;

  UPDATE public.vouchers SET balance_cents = balance_cents - _amount_cents WHERE id = _voucher_id;
  INSERT INTO public.voucher_redemptions (voucher_id, sale_id, amount_cents, redeemed_by)
    VALUES (_voucher_id, _sale_id, _amount_cents, _redeemed_by)
    RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object('redemption_id', v_redemption_id, 'remaining_balance_cents', v_balance - _amount_cents);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_voucher_redemption(_redemption_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_voucher_id uuid;
  v_amount integer;
  v_already_reversed timestamptz;
BEGIN
  IF NOT (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT voucher_id, amount_cents, reversed_at
    INTO v_voucher_id, v_amount, v_already_reversed
    FROM public.voucher_redemptions WHERE id = _redemption_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;
  IF v_already_reversed IS NOT NULL THEN RAISE EXCEPTION 'Already reversed'; END IF;

  UPDATE public.vouchers SET balance_cents = balance_cents + v_amount WHERE id = v_voucher_id;
  UPDATE public.voucher_redemptions SET reversed_at = now() WHERE id = _redemption_id;

  RETURN jsonb_build_object('reversed_amount_cents', v_amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reverse_voucher_redemption(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_voucher_redemption(uuid) TO authenticated;
