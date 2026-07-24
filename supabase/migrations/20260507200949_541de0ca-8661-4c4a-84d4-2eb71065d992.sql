
CREATE TABLE public.imported_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  dob date,
  notes text,
  invited_at timestamptz,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);

ALTER TABLE public.imported_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view imported clients"
  ON public.imported_clients FOR SELECT TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff insert imported clients"
  ON public.imported_clients FOR INSERT TO authenticated
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff update imported clients"
  ON public.imported_clients FOR UPDATE TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Admins delete imported clients"
  ON public.imported_clients FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE TRIGGER touch_imported_clients_updated_at
  BEFORE UPDATE ON public.imported_clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
