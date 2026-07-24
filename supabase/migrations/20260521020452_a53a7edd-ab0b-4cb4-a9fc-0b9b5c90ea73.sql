
CREATE TABLE public.staff_google_oauth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL UNIQUE REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz NOT NULL,
  scope text,
  calendar_id text NOT NULL DEFAULT 'primary',
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_refreshed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_google_oauth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all staff google oauth"
  ON public.staff_google_oauth FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Staff view own google oauth"
  ON public.staff_google_oauth FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_profiles sp
    WHERE sp.id = staff_google_oauth.staff_id AND sp.user_id = auth.uid()
  ));

CREATE POLICY "Staff delete own google oauth"
  ON public.staff_google_oauth FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_profiles sp
    WHERE sp.id = staff_google_oauth.staff_id AND sp.user_id = auth.uid()
  ));

CREATE INDEX idx_staff_google_oauth_staff_id ON public.staff_google_oauth(staff_id);
