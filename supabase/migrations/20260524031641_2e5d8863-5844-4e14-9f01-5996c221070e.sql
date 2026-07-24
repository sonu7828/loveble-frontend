CREATE TABLE public.promotion_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  instagram_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.promotion_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit promotion entries"
  ON public.promotion_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins view entries"
  ON public.promotion_entries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));