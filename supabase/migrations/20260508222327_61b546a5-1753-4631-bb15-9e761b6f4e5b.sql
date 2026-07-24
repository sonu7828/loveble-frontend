
DO $$ BEGIN
  CREATE TYPE public.waitlist_status AS ENUM ('open','notified','booked','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.waitlist_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_first_name text NOT NULL,
  client_last_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text NOT NULL,
  service_id uuid NOT NULL,
  location_id uuid,
  staff_id uuid,
  desired_date_from date NOT NULL,
  desired_date_to date NOT NULL,
  notes text,
  status public.waitlist_status NOT NULL DEFAULT 'open',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_open ON public.waitlist_requests (status, desired_date_from, desired_date_to);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist_requests (lower(client_email));

ALTER TABLE public.waitlist_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_waitlist_touch ON public.waitlist_requests;
CREATE TRIGGER trg_waitlist_touch BEFORE UPDATE ON public.waitlist_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Anyone can join waitlist"
ON public.waitlist_requests FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Clients view own waitlist"
ON public.waitlist_requests FOR SELECT TO authenticated
USING (current_client_email() IS NOT NULL AND lower(client_email) = current_client_email());

CREATE POLICY "Clients update own waitlist"
ON public.waitlist_requests FOR UPDATE TO authenticated
USING (current_client_email() IS NOT NULL AND lower(client_email) = current_client_email())
WITH CHECK (current_client_email() IS NOT NULL AND lower(client_email) = current_client_email());

CREATE POLICY "Staff view all waitlist"
ON public.waitlist_requests FOR SELECT TO authenticated
USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff manage all waitlist"
ON public.waitlist_requests FOR UPDATE TO authenticated
USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Admins delete waitlist"
ON public.waitlist_requests FOR DELETE TO authenticated
USING (is_admin(auth.uid()));
