
-- 1. Per-service rebook follow-up window
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS rebook_followup_days integer;

-- 2. Booking funnel events (client-side analytics)
CREATE TABLE IF NOT EXISTS public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  event_name text NOT NULL,
  step integer,
  service_id uuid,
  location_id uuid,
  staff_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_events_session ON public.booking_events(session_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_created ON public.booking_events(created_at DESC);

ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record booking events"
  ON public.booking_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff view booking events"
  ON public.booking_events FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

-- 3. Booking abandonment tracking
CREATE TABLE IF NOT EXISTS public.booking_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE,
  email text,
  first_name text,
  last_name text,
  phone text,
  service_id uuid,
  location_id uuid,
  staff_id uuid,
  intended_start_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_attempts_email ON public.booking_attempts(lower(email));
CREATE INDEX IF NOT EXISTS idx_booking_attempts_pending
  ON public.booking_attempts(started_at)
  WHERE completed_at IS NULL AND notified_at IS NULL;

ALTER TABLE public.booking_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view booking attempts"
  ON public.booking_attempts FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE TRIGGER trg_booking_attempts_updated_at
  BEFORE UPDATE ON public.booking_attempts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
