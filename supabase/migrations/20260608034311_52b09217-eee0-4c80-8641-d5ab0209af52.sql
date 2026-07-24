
-- =========================
-- product_lots
-- =========================
CREATE TABLE public.product_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  lot_number text NOT NULL,
  expiration_date date,
  quantity_initial numeric NOT NULL DEFAULT 0 CHECK (quantity_initial >= 0),
  quantity_remaining numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unit',
  category text,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  low_stock_threshold numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_lots_unique_per_product
  ON public.product_lots (lower(product_name), lower(lot_number));
CREATE INDEX product_lots_active_idx ON public.product_lots(is_active) WHERE is_active;
CREATE INDEX product_lots_exp_idx ON public.product_lots(expiration_date);

GRANT SELECT, INSERT, UPDATE ON public.product_lots TO authenticated;
GRANT ALL ON public.product_lots TO service_role;
ALTER TABLE public.product_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff view lots" ON public.product_lots
  FOR SELECT TO authenticated USING (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Staff manage lots" ON public.product_lots
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

CREATE TRIGGER trg_product_lots_updated
  BEFORE UPDATE ON public.product_lots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- inventory_movements (append-only ledger)
-- =========================
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.product_lots(id) ON DELETE CASCADE,
  qty_delta numeric NOT NULL,
  reason text NOT NULL,
  ref_type text,
  ref_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inv_mov_lot_idx ON public.inventory_movements(lot_id, created_at DESC);

GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff view movements" ON public.inventory_movements
  FOR SELECT TO authenticated USING (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Staff write movements" ON public.inventory_movements
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- =========================
-- chart_lot_consumption
-- =========================
CREATE TABLE public.chart_lot_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.product_lots(id),
  qty numeric NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  category text,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chart_lot_consumption_note_idx ON public.chart_lot_consumption(clinical_note_id);
CREATE INDEX chart_lot_consumption_lot_idx ON public.chart_lot_consumption(lot_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_lot_consumption TO authenticated;
GRANT ALL ON public.chart_lot_consumption TO service_role;
ALTER TABLE public.chart_lot_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff view consumption" ON public.chart_lot_consumption
  FOR SELECT TO authenticated USING (public.is_clinical_staff(auth.uid()));
CREATE POLICY "Clinical staff write consumption" ON public.chart_lot_consumption
  FOR ALL TO authenticated
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));

-- =========================
-- RPCs
-- =========================
CREATE OR REPLACE FUNCTION public.receive_lot(
  _product_name text,
  _lot_number text,
  _expiration_date date,
  _quantity numeric,
  _unit text DEFAULT 'unit',
  _category text DEFAULT NULL,
  _location_id uuid DEFAULT NULL,
  _low_stock_threshold numeric DEFAULT 0,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot_id uuid;
BEGIN
  IF NOT public.is_staff_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  INSERT INTO public.product_lots (
    product_name, lot_number, expiration_date, quantity_initial, quantity_remaining,
    unit, category, location_id, low_stock_threshold, notes, received_by
  ) VALUES (
    _product_name, _lot_number, _expiration_date, _quantity, _quantity,
    coalesce(_unit, 'unit'), _category, _location_id, coalesce(_low_stock_threshold, 0), _notes, auth.uid()
  )
  ON CONFLICT (lower(product_name), lower(lot_number)) DO UPDATE
    SET quantity_initial = product_lots.quantity_initial + EXCLUDED.quantity_initial,
        quantity_remaining = product_lots.quantity_remaining + EXCLUDED.quantity_initial,
        expiration_date = COALESCE(EXCLUDED.expiration_date, product_lots.expiration_date),
        is_active = true,
        location_id = COALESCE(EXCLUDED.location_id, product_lots.location_id),
        notes = COALESCE(EXCLUDED.notes, product_lots.notes),
        updated_at = now()
  RETURNING id INTO v_lot_id;

  INSERT INTO public.inventory_movements (lot_id, qty_delta, reason, created_by, notes)
    VALUES (v_lot_id, _quantity, 'receive', auth.uid(), _notes);

  RETURN v_lot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_lot(
  _lot_id uuid,
  _qty numeric,
  _ref_type text DEFAULT NULL,
  _ref_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric;
BEGIN
  IF NOT public.is_clinical_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  UPDATE public.product_lots
     SET quantity_remaining = quantity_remaining - _qty,
         is_active = CASE WHEN quantity_remaining - _qty <= 0 THEN false ELSE is_active END,
         updated_at = now()
   WHERE id = _lot_id
  RETURNING quantity_remaining INTO v_remaining;

  IF NOT FOUND THEN RAISE EXCEPTION 'Lot not found'; END IF;

  INSERT INTO public.inventory_movements (lot_id, qty_delta, reason, ref_type, ref_id, created_by, notes)
    VALUES (_lot_id, -_qty, 'consume', _ref_type, _ref_id, auth.uid(), _notes);

  RETURN v_remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_lot(
  _lot_id uuid,
  _new_quantity numeric,
  _reason text DEFAULT 'adjust',
  _notes text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old numeric;
  v_delta numeric;
BEGIN
  IF NOT public.is_staff_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _new_quantity < 0 THEN RAISE EXCEPTION 'Quantity cannot be negative'; END IF;

  SELECT quantity_remaining INTO v_old FROM public.product_lots WHERE id = _lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lot not found'; END IF;

  v_delta := _new_quantity - v_old;

  UPDATE public.product_lots
     SET quantity_remaining = _new_quantity,
         is_active = CASE WHEN _new_quantity <= 0 THEN false ELSE true END,
         updated_at = now()
   WHERE id = _lot_id;

  INSERT INTO public.inventory_movements (lot_id, qty_delta, reason, created_by, notes)
    VALUES (_lot_id, v_delta, coalesce(_reason, 'adjust'), auth.uid(), _notes);

  RETURN _new_quantity;
END;
$$;
