-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'approved', 'denied', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.recurrence_rule AS ENUM ('weekly', 'alternating_weeks', 'nth_weekday_of_month');
CREATE TYPE public.override_type AS ENUM ('extra_availability', 'block');

-- =========================================
-- USER ROLES (separate table for security)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'staff')
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================
-- LOCATIONS
-- =========================================
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view locations" ON public.locations FOR SELECT USING (is_active);
CREATE POLICY "Admins manage locations" ON public.locations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================
-- STAFF PROFILES
-- =========================================
CREATE TABLE public.staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  title TEXT NOT NULL,
  email TEXT,
  bio TEXT,
  color TEXT NOT NULL DEFAULT '#c97c5d',
  is_owner BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  google_calendar_token JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active staff (no tokens)" ON public.staff_profiles
  FOR SELECT USING (is_active);
CREATE POLICY "Admins manage staff profiles" ON public.staff_profiles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Staff can update own profile" ON public.staff_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================
-- SERVICES
-- =========================================
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view categories" ON public.service_categories FOR SELECT USING (is_active);
CREATE POLICY "Admins manage categories" ON public.service_categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  buffer_minutes INT NOT NULL DEFAULT 0,
  requires_consult BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_category ON public.services(category_id);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view services" ON public.services FOR SELECT USING (is_active);
CREATE POLICY "Admins manage services" ON public.services FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- which staff offers which service at which location
CREATE TABLE public.service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  UNIQUE (service_id, staff_id, location_id)
);
CREATE INDEX idx_sp_service ON public.service_providers(service_id);
CREATE INDEX idx_sp_staff ON public.service_providers(staff_id);
CREATE INDEX idx_sp_location ON public.service_providers(location_id);
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view service providers" ON public.service_providers FOR SELECT USING (true);
CREATE POLICY "Admins manage service providers" ON public.service_providers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================
-- SCHEDULES
-- =========================================
CREATE TABLE public.weekly_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  recurrence public.recurrence_rule NOT NULL DEFAULT 'weekly',
  -- For alternating_weeks: anchor_date defines week-0; toggles each week. day_of_week in this row = "the on-week day".
  -- For nth_weekday_of_month: weeks_of_month is an int[] of 1..5 (e.g. {2,3} for 2nd & 3rd of month).
  anchor_date DATE,
  weeks_of_month INT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ws_staff ON public.weekly_schedules(staff_id);
ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view weekly schedules" ON public.weekly_schedules FOR SELECT USING (is_active);
CREATE POLICY "Admins manage all schedules" ON public.weekly_schedules FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Staff manage own schedule" ON public.weekly_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid()));

CREATE TABLE public.schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  override_type public.override_type NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX idx_so_staff_time ON public.schedule_overrides(staff_id, start_at, end_at);
ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view overrides" ON public.schedule_overrides FOR SELECT USING (true);
CREATE POLICY "Admins manage all overrides" ON public.schedule_overrides FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Staff manage own overrides" ON public.schedule_overrides FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid()));

-- =========================================
-- APPOINTMENTS
-- =========================================
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  -- Client (guest) info
  client_first_name TEXT NOT NULL,
  client_last_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_dob DATE,
  client_notes TEXT,
  is_new_client BOOLEAN DEFAULT true,
  -- Stripe
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  stripe_setup_intent_id TEXT,
  no_show_charge_id TEXT,
  no_show_charged_at TIMESTAMPTZ,
  -- Admin actions
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  denial_reason TEXT,
  -- Calendar
  google_event_owner_id TEXT,
  google_event_provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX idx_appt_staff_time ON public.appointments(staff_id, start_at);
CREATE INDEX idx_appt_status ON public.appointments(status);
CREATE INDEX idx_appt_token ON public.appointments(public_token);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Anyone can create a booking (guest). Edge function/webhooks may also insert.
CREATE POLICY "Anyone can create appointment" ON public.appointments
  FOR INSERT WITH CHECK (true);

-- Staff see their own; admins see all.
CREATE POLICY "Staff view own appointments" ON public.appointments
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid())
  );

-- Staff update their own; admins update all.
CREATE POLICY "Staff update own appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_id AND sp.user_id = auth.uid())
  );

-- Admins delete.
CREATE POLICY "Admins delete appointments" ON public.appointments
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.appointment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_status public.appointment_status,
  to_status public.appointment_status,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aal_appt ON public.appointment_audit_log(appointment_id);
ALTER TABLE public.appointment_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view audit for own appts" ON public.appointment_audit_log
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.staff_profiles sp ON sp.id = a.staff_id
      WHERE a.id = appointment_id AND sp.user_id = auth.uid()
    )
  );
CREATE POLICY "Authenticated can insert audit" ON public.appointment_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- =========================================
-- updated_at triggers
-- =========================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER tg_staff_updated BEFORE UPDATE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tg_appt_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();