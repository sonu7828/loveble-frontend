
-- Vendor / BAA tracker
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  touches_phi boolean NOT NULL DEFAULT false,
  baa_required boolean NOT NULL DEFAULT true,
  baa_status text NOT NULL DEFAULT 'none' CHECK (baa_status IN ('none','requested','signed','declined','expired','not_applicable')),
  baa_signed_at date,
  baa_renewal_at date,
  contact_name text,
  contact_email text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER vendors_touch BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Breach reports (immutable for non-admin; append-only)
CREATE TABLE public.breach_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name text,
  reporter_email text,
  occurred_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  phi_involved text,
  individuals_affected int,
  systems_involved text,
  immediate_actions text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','closed','reported_to_hhs')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.breach_reports TO authenticated;
GRANT UPDATE (status) ON public.breach_reports TO authenticated;
GRANT ALL ON public.breach_reports TO service_role;
ALTER TABLE public.breach_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical staff can file breach reports" ON public.breach_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_clinical_staff(auth.uid()) AND reporter_user_id = auth.uid());
CREATE POLICY "Reporters see their own, admins see all" ON public.breach_reports FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR reporter_user_id = auth.uid());
CREATE POLICY "Only admins can update status" ON public.breach_reports FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Lock the original report fields; only status can change (via GRANT above).
CREATE OR REPLACE FUNCTION public.protect_breach_report() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.description IS DISTINCT FROM OLD.description
     OR NEW.reporter_user_id IS DISTINCT FROM OLD.reporter_user_id
     OR NEW.reporter_name IS DISTINCT FROM OLD.reporter_name
     OR NEW.reporter_email IS DISTINCT FROM OLD.reporter_email
     OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
     OR NEW.discovered_at IS DISTINCT FROM OLD.discovered_at
     OR NEW.phi_involved IS DISTINCT FROM OLD.phi_involved
     OR NEW.individuals_affected IS DISTINCT FROM OLD.individuals_affected
     OR NEW.systems_involved IS DISTINCT FROM OLD.systems_involved
     OR NEW.immediate_actions IS DISTINCT FROM OLD.immediate_actions
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Breach report fields are immutable. Add a follow-up note instead.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER breach_reports_immutable BEFORE UPDATE ON public.breach_reports
  FOR EACH ROW EXECUTE FUNCTION public.protect_breach_report();

-- Breach follow-up notes (append-only)
CREATE TABLE public.breach_report_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breach_report_id uuid NOT NULL REFERENCES public.breach_reports(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.breach_report_notes TO authenticated;
GRANT ALL ON public.breach_report_notes TO service_role;
ALTER TABLE public.breach_report_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins insert notes" ON public.breach_report_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND author_user_id = auth.uid());
CREATE POLICY "Admins read notes" ON public.breach_report_notes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- PHI deletion requests (patient right-to-delete)
CREATE TABLE public.phi_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','completed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text
);
GRANT SELECT, INSERT ON public.phi_deletion_requests TO authenticated;
GRANT UPDATE (status, resolved_at, resolved_by, notes) ON public.phi_deletion_requests TO authenticated;
GRANT ALL ON public.phi_deletion_requests TO service_role;
ALTER TABLE public.phi_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients file their own deletion request" ON public.phi_deletion_requests FOR INSERT TO authenticated
  WITH CHECK (lower(client_email) = public.current_client_email());
CREATE POLICY "Patients see their own, admins see all" ON public.phi_deletion_requests FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR lower(client_email) = public.current_client_email());
CREATE POLICY "Admins update deletion requests" ON public.phi_deletion_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Seed vendors
INSERT INTO public.vendors (name, category, touches_phi, baa_required, baa_status, notes) VALUES
  ('Lovable Cloud', 'Backend / DB / Auth / Storage', true, true, 'signed', 'Signed via Lovable Cloud enterprise BAA'),
  ('Lovable AI Gateway', 'AI (chart notes, AI Scribe)', true, true, 'requested', 'Confirm no-training attestation'),
  ('Brevo', 'Transactional email', true, true, 'none', 'Contains client name + appointment info'),
  ('Twilio', 'SMS reminders', true, true, 'none', 'Must enable Twilio HIPAA edition'),
  ('Stripe', 'Payments', true, true, 'none', 'Name + amount only; sign BAA'),
  ('Affirm', 'Financing', true, false, 'none', 'Recommended BAA; else no-PHI attestation'),
  ('Google Workspace', 'OAuth / Calendar sync', true, true, 'none', 'Requires paid Workspace + BAA');
