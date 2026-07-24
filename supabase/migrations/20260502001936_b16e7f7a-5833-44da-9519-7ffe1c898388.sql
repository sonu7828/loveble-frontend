
UPDATE staff_profiles SET email = 'kamarentheinjector@gmail.com' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
UPDATE staff_profiles SET email = 'skinology2014@gmail.com' WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
UPDATE staff_profiles SET email = 'djsooshi@gmail.com' WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

CREATE OR REPLACE FUNCTION public.is_scheduler_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'scheduler')
$$;

CREATE POLICY "Schedulers view all appointments"
ON appointments FOR SELECT TO authenticated
USING (is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Schedulers update all appointments"
ON appointments FOR UPDATE TO authenticated
USING (is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Schedulers view audit"
ON appointment_audit_log FOR SELECT TO authenticated
USING (is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Schedulers insert audit"
ON appointment_audit_log FOR INSERT TO authenticated
WITH CHECK (is_scheduler_or_admin(auth.uid()));

CREATE TABLE public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role app_role NOT NULL DEFAULT 'staff',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invitations"
ON staff_invitations FOR ALL TO authenticated
USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

INSERT INTO staff_profiles (id, full_name, title, email, color, is_owner, is_active)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Patient Koala', 'Scheduler', 'pia@rapplitemedia.com', '#8b9d83', false, true)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, title = EXCLUDED.title;
