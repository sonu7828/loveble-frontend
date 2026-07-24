
-- Harden client_payment_methods access
-- 1) Remove existing policies
DROP POLICY IF EXISTS "Clients view own saved cards" ON public.client_payment_methods;
DROP POLICY IF EXISTS "Staff manage client payment methods" ON public.client_payment_methods;

-- 2) Only admins and staff (not schedulers/receptionists) can add/remove/update cards
CREATE POLICY "Admins and staff manage client payment methods"
  ON public.client_payment_methods
  FOR ALL
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- 3) Clients no longer have direct SELECT access (no policy = no access).
-- Expose only "does a card exist?" via a security-definer function.
CREATE OR REPLACE FUNCTION public.client_has_card_on_file()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_payment_methods
    WHERE current_client_email() IS NOT NULL
      AND lower(client_email) = current_client_email()
  )
$$;

REVOKE ALL ON FUNCTION public.client_has_card_on_file() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_has_card_on_file() TO authenticated;
