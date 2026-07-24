
-- Enums
CREATE TYPE public.product_kind AS ENUM ('retail', 'package', 'service_addon');
CREATE TYPE public.promo_kind AS ENUM ('percent', 'fixed', 'package_price');
CREATE TYPE public.sale_status AS ENUM ('draft', 'pending_payment', 'paid', 'voided', 'refunded', 'partially_refunded');
CREATE TYPE public.sale_payment_method AS ENUM ('terminal', 'manual_card', 'card_on_file', 'cash', 'voucher_only', 'mixed');
CREATE TYPE public.sale_item_kind AS ENUM ('service', 'unit_service', 'product', 'package', 'voucher_sale', 'tip', 'fee', 'discount', 'voucher_redemption');
CREATE TYPE public.voucher_source AS ENUM ('purchased', 'comp', 'refund_credit');

-- Existing table additions
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS processing_fee_pct numeric(5,2) NOT NULL DEFAULT 3.50,
  ADD COLUMN IF NOT EXISTS tip_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stripe_terminal_location_id text;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS tippable boolean NOT NULL DEFAULT true;

-- products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  kind public.product_kind NOT NULL DEFAULT 'retail',
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  taxable boolean NOT NULL DEFAULT false,
  tippable boolean NOT NULL DEFAULT false,
  location_id uuid,
  service_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_active ON public.products(is_active) WHERE is_active;
CREATE INDEX idx_products_kind ON public.products(kind);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active products" ON public.products
  FOR SELECT USING (is_active);
CREATE POLICY "Staff manage products" ON public.products
  FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Admins delete products" ON public.products
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- unit_services
CREATE TABLE public.unit_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL UNIQUE,
  price_per_unit_cents integer NOT NULL CHECK (price_per_unit_cents > 0),
  unit_label text NOT NULL DEFAULT 'unit',
  min_units integer NOT NULL DEFAULT 1,
  max_units integer NOT NULL DEFAULT 500,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_unit_services_updated BEFORE UPDATE ON public.unit_services
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.unit_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view unit services" ON public.unit_services FOR SELECT USING (is_active);
CREATE POLICY "Staff manage unit services" ON public.unit_services
  FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

-- promo_codes
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  kind public.promo_kind NOT NULL,
  value_cents integer,
  value_pct numeric(5,2),
  applies_to text NOT NULL DEFAULT 'all', -- 'all' | 'service:<uuid>' | 'product:<uuid>' | 'category:<uuid>'
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "min_units": 30, "min_subtotal_cents": 50000 }
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  staff_only boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'percent' AND value_pct IS NOT NULL) OR
    (kind = 'fixed' AND value_cents IS NOT NULL) OR
    (kind = 'package_price' AND value_cents IS NOT NULL)
  )
);
CREATE INDEX idx_promo_codes_active ON public.promo_codes(is_active) WHERE is_active;
CREATE TRIGGER trg_promo_codes_updated BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view promo codes" ON public.promo_codes
  FOR SELECT TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Staff manage promo codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Admins delete promo codes" ON public.promo_codes
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- vouchers
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  original_amount_cents integer NOT NULL CHECK (original_amount_cents > 0),
  balance_cents integer NOT NULL CHECK (balance_cents >= 0),
  issued_to_email text,
  issued_to_name text,
  source public.voucher_source NOT NULL DEFAULT 'purchased',
  source_sale_id uuid,
  notes text,
  issued_by uuid,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vouchers_email ON public.vouchers(lower(issued_to_email));
CREATE INDEX idx_vouchers_active ON public.vouchers(is_active) WHERE is_active;
CREATE TRIGGER trg_vouchers_updated BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own vouchers" ON public.vouchers
  FOR SELECT TO authenticated
  USING (current_client_email() IS NOT NULL AND lower(issued_to_email) = current_client_email());
CREATE POLICY "Staff view vouchers" ON public.vouchers
  FOR SELECT TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Staff manage vouchers" ON public.vouchers
  FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Admins delete vouchers" ON public.vouchers
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- sales
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid,
  client_email text,
  client_first_name text,
  client_last_name text,
  client_phone text,
  location_id uuid NOT NULL,
  staff_id uuid,
  cashier_user_id uuid,
  subtotal_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  tip_cents integer NOT NULL DEFAULT 0,
  processing_fee_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  voucher_applied_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  amount_due_cents integer NOT NULL DEFAULT 0,
  status public.sale_status NOT NULL DEFAULT 'draft',
  payment_method public.sale_payment_method,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_terminal_reader_id text,
  reader_action_status text,
  receipt_url text,
  receipt_email_sent_at timestamptz,
  notes text,
  refunded_amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_appointment ON public.sales(appointment_id);
CREATE INDEX idx_sales_email ON public.sales(lower(client_email));
CREATE INDEX idx_sales_status ON public.sales(status);
CREATE INDEX idx_sales_paid_at ON public.sales(paid_at DESC);
CREATE INDEX idx_sales_location ON public.sales(location_id);
CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own sales" ON public.sales
  FOR SELECT TO authenticated
  USING (current_client_email() IS NOT NULL AND lower(client_email) = current_client_email());
CREATE POLICY "Staff view sales" ON public.sales
  FOR SELECT TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Staff manage sales" ON public.sales
  FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Admins delete sales" ON public.sales
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- sale_items
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  kind public.sale_item_kind NOT NULL,
  reference_id uuid,
  label text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  line_total_cents integer NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT false,
  tippable boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own sale items" ON public.sale_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id
    AND current_client_email() IS NOT NULL AND lower(s.client_email) = current_client_email()));
CREATE POLICY "Staff view sale items" ON public.sale_items
  FOR SELECT TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Staff manage sale items" ON public.sale_items
  FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

-- voucher_redemptions
CREATE TABLE public.voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  redeemed_by uuid,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz
);
CREATE INDEX idx_voucher_redemptions_voucher ON public.voucher_redemptions(voucher_id);
CREATE INDEX idx_voucher_redemptions_sale ON public.voucher_redemptions(sale_id);
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own voucher redemptions" ON public.voucher_redemptions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vouchers v WHERE v.id = voucher_redemptions.voucher_id
    AND current_client_email() IS NOT NULL AND lower(v.issued_to_email) = current_client_email()));
CREATE POLICY "Staff view voucher redemptions" ON public.voucher_redemptions
  FOR SELECT TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Staff manage voucher redemptions" ON public.voucher_redemptions
  FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

-- terminal_readers
CREATE TABLE public.terminal_readers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  label text NOT NULL,
  stripe_reader_id text NOT NULL UNIQUE,
  device_type text,
  serial_number text,
  status text NOT NULL DEFAULT 'offline',
  last_seen_at timestamptz,
  registered_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_terminal_readers_location ON public.terminal_readers(location_id);
CREATE TRIGGER trg_terminal_readers_updated BEFORE UPDATE ON public.terminal_readers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.terminal_readers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view readers" ON public.terminal_readers
  FOR SELECT TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));
CREATE POLICY "Admins manage readers" ON public.terminal_readers
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Voucher safe-redeem function (atomic, prevents double-spend)
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
  IF _amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT balance_cents, is_active, expires_at
    INTO v_balance, v_active, v_expires
    FROM public.vouchers
    WHERE id = _voucher_id
    FOR UPDATE;

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

-- Voucher reversal (for refunds)
CREATE OR REPLACE FUNCTION public.reverse_voucher_redemption(
  _redemption_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_voucher_id uuid;
  v_amount integer;
  v_already_reversed timestamptz;
BEGIN
  SELECT voucher_id, amount_cents, reversed_at
    INTO v_voucher_id, v_amount, v_already_reversed
    FROM public.voucher_redemptions
    WHERE id = _redemption_id
    FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;
  IF v_already_reversed IS NOT NULL THEN RAISE EXCEPTION 'Already reversed'; END IF;

  UPDATE public.vouchers SET balance_cents = balance_cents + v_amount WHERE id = v_voucher_id;
  UPDATE public.voucher_redemptions SET reversed_at = now() WHERE id = _redemption_id;

  RETURN jsonb_build_object('reversed_amount_cents', v_amount);
END;
$$;
