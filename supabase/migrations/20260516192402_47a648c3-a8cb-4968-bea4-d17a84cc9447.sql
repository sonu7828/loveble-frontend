
CREATE TABLE public.staff_time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  notes text,
  adjusted_by uuid,
  adjusted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_time_entries_staff ON public.staff_time_entries (staff_id, clock_in DESC);
CREATE UNIQUE INDEX idx_staff_time_entries_open ON public.staff_time_entries (staff_id) WHERE clock_out IS NULL;

ALTER TABLE public.staff_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own time entries"
  ON public.staff_time_entries FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_time_entries.staff_id AND sp.user_id = auth.uid())
  );

CREATE POLICY "Staff clock themselves in"
  ON public.staff_time_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_time_entries.staff_id AND sp.user_id = auth.uid())
  );

CREATE POLICY "Staff clock themselves out"
  ON public.staff_time_entries FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_time_entries.staff_id AND sp.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = staff_time_entries.staff_id AND sp.user_id = auth.uid())
  );

CREATE POLICY "Admins manage all time entries"
  ON public.staff_time_entries FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER touch_staff_time_entries
  BEFORE UPDATE ON public.staff_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
