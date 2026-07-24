CREATE TABLE public.client_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_payment_method_id text NOT NULL,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  cardholder_name text,
  is_default boolean NOT NULL DEFAULT false,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_payment_method_id)
);

CREATE INDEX idx_client_payment_methods_email ON public.client_payment_methods (lower(client_email));

ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage client payment methods"
  ON public.client_payment_methods
  FOR ALL
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Clients view own saved cards"
  ON public.client_payment_methods
  FOR SELECT
  TO authenticated
  USING (public.current_client_email() IS NOT NULL AND lower(client_email) = public.current_client_email());

CREATE TRIGGER tr_client_payment_methods_touch
  BEFORE UPDATE ON public.client_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();