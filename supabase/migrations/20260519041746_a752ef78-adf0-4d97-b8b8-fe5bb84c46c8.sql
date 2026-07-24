CREATE TABLE IF NOT EXISTS public.blocked_clients (
  email text PRIMARY KEY,
  reason text,
  blocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view blocked clients"
  ON public.blocked_clients FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff insert blocked clients"
  ON public.blocked_clients FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Staff update blocked clients"
  ON public.blocked_clients FOR UPDATE
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Admins delete blocked clients"
  ON public.blocked_clients FOR DELETE
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));
