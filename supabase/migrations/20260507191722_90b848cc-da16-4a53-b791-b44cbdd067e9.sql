
-- Helper: get current user's verified email (lowercase). Returns null if unverified.
CREATE OR REPLACE FUNCTION public.current_client_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
$$;

-- Client profiles
CREATE TABLE public.client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  dob date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_profiles_email ON public.client_profiles (lower(email));

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view own profile"
  ON public.client_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Clients insert own profile"
  ON public.client_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Clients update own profile"
  ON public.client_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff view all client profiles"
  ON public.client_profiles FOR SELECT TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

CREATE TRIGGER touch_client_profiles_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Allow clients to view their own appointments by verified email
CREATE POLICY "Clients view own appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (
    public.current_client_email() IS NOT NULL
    AND lower(client_email) = public.current_client_email()
  );

-- Allow clients to cancel their own pending/approved appointments
CREATE POLICY "Clients cancel own appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (
    public.current_client_email() IS NOT NULL
    AND lower(client_email) = public.current_client_email()
    AND status IN ('pending', 'approved')
  )
  WITH CHECK (
    public.current_client_email() IS NOT NULL
    AND lower(client_email) = public.current_client_email()
  );

-- View own signed consents
CREATE POLICY "Clients view own consent signatures"
  ON public.consent_signatures FOR SELECT TO authenticated
  USING (
    public.current_client_email() IS NOT NULL
    AND lower(client_email) = public.current_client_email()
  );

-- View own appointment services
CREATE POLICY "Clients view own appointment services"
  ON public.appointment_services FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_services.appointment_id
        AND public.current_client_email() IS NOT NULL
        AND lower(a.client_email) = public.current_client_email()
    )
  );

-- View own assigned consents
CREATE POLICY "Clients view own appointment consents"
  ON public.appointment_consents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_consents.appointment_id
        AND public.current_client_email() IS NOT NULL
        AND lower(a.client_email) = public.current_client_email()
    )
  );
