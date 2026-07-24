
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.compliance_assignment_status AS ENUM ('pending','signed','expired','superseded','waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.compliance_signature_status AS ENUM ('active','superseded','revoked','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ compliance_protocols ============
CREATE TABLE IF NOT EXISTS public.compliance_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  summary text,
  body_markdown text NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  version int NOT NULL DEFAULT 1,
  renewal_months int NOT NULL DEFAULT 12,
  requires_license boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  applies_to_roles text[] NOT NULL DEFAULT ARRAY['staff','nurse_practitioner','admin']::text[],
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

GRANT SELECT ON public.compliance_protocols TO authenticated;
GRANT ALL ON public.compliance_protocols TO service_role;
ALTER TABLE public.compliance_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read active protocols"
  ON public.compliance_protocols FOR SELECT
  TO authenticated
  USING (public.is_clinical_staff(auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage protocols"
  ON public.compliance_protocols FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_compliance_protocols_touch
  BEFORE UPDATE ON public.compliance_protocols
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ compliance_protocol_assignments ============
CREATE TABLE IF NOT EXISTS public.compliance_protocol_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES public.compliance_protocols(id) ON DELETE CASCADE,
  protocol_version int NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.compliance_assignment_status NOT NULL DEFAULT 'pending',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  signed_signature_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (protocol_id, protocol_version, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_assign_staff ON public.compliance_protocol_assignments(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_assign_protocol ON public.compliance_protocol_assignments(protocol_id);

GRANT SELECT, INSERT, UPDATE ON public.compliance_protocol_assignments TO authenticated;
GRANT ALL ON public.compliance_protocol_assignments TO service_role;
ALTER TABLE public.compliance_protocol_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read own assignments"
  ON public.compliance_protocol_assignments FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR staff_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = compliance_protocol_assignments.staff_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage assignments"
  ON public.compliance_protocol_assignments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_compliance_assign_touch
  BEFORE UPDATE ON public.compliance_protocol_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ compliance_signatures ============
CREATE TABLE IF NOT EXISTS public.compliance_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES public.compliance_protocols(id),
  protocol_version int NOT NULL,
  protocol_slug text NOT NULL,
  protocol_title text NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id),
  staff_user_id uuid NOT NULL REFERENCES auth.users(id),
  signed_full_name text NOT NULL,
  license_number text,
  license_state text,
  signature_png text NOT NULL,
  section_initials jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_sha256 text,
  ip_address text,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  pdf_path text,
  pdf_sha256 text,
  status public.compliance_signature_status NOT NULL DEFAULT 'active',
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_sig_staff ON public.compliance_signatures(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_sig_protocol ON public.compliance_signatures(protocol_id, protocol_version);
CREATE INDEX IF NOT EXISTS idx_compliance_sig_expires ON public.compliance_signatures(expires_at) WHERE status = 'active';

GRANT SELECT, INSERT ON public.compliance_signatures TO authenticated;
GRANT ALL ON public.compliance_signatures TO service_role;
ALTER TABLE public.compliance_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read own signatures"
  ON public.compliance_signatures FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR staff_user_id = auth.uid()
  );

CREATE POLICY "Staff create own signatures"
  ON public.compliance_signatures FOR INSERT TO authenticated
  WITH CHECK (
    staff_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = compliance_signatures.staff_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage signatures"
  ON public.compliance_signatures FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_compliance_sig_touch
  BEFORE UPDATE ON public.compliance_signatures
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Immutability trigger for signatures ============
CREATE OR REPLACE FUNCTION public.protect_compliance_signature()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    IF NEW.signed_full_name IS DISTINCT FROM OLD.signed_full_name
       OR NEW.signature_png IS DISTINCT FROM OLD.signature_png
       OR NEW.section_initials IS DISTINCT FROM OLD.section_initials
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.protocol_id IS DISTINCT FROM OLD.protocol_id
       OR NEW.protocol_version IS DISTINCT FROM OLD.protocol_version
       OR NEW.staff_id IS DISTINCT FROM OLD.staff_id
       OR NEW.staff_user_id IS DISTINCT FROM OLD.staff_user_id THEN
      RAISE EXCEPTION 'Compliance signatures are immutable. Contact an admin to revoke and re-sign.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_protect_compliance_signature
  BEFORE UPDATE ON public.compliance_signatures
  FOR EACH ROW EXECUTE FUNCTION public.protect_compliance_signature();

-- ============ When a signature is inserted, mark assignment signed ============
CREATE OR REPLACE FUNCTION public.link_compliance_signature_to_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.compliance_protocol_assignments
     SET status = 'signed',
         signed_signature_id = NEW.id,
         updated_at = now()
   WHERE protocol_id = NEW.protocol_id
     AND protocol_version = NEW.protocol_version
     AND staff_id = NEW.staff_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_link_compliance_signature
  AFTER INSERT ON public.compliance_signatures
  FOR EACH ROW EXECUTE FUNCTION public.link_compliance_signature_to_assignment();

-- ============ When a new protocol version is published, supersede & re-assign ============
CREATE OR REPLACE FUNCTION public.handle_compliance_protocol_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_due timestamptz;
BEGIN
  IF NEW.is_active = true
     AND NEW.published_at IS NOT NULL
     AND (OLD.published_at IS NULL OR NEW.version <> OLD.version OR OLD.is_active = false) THEN

    -- Supersede prior signatures for OTHER versions of the same slug
    UPDATE public.compliance_signatures
       SET status = 'superseded', updated_at = now()
     WHERE protocol_slug = NEW.slug
       AND (protocol_id <> NEW.id OR protocol_version <> NEW.version)
       AND status = 'active';

    -- Supersede prior pending assignments for OTHER versions of the same slug
    UPDATE public.compliance_protocol_assignments a
       SET status = 'superseded', updated_at = now()
      FROM public.compliance_protocols p
     WHERE a.protocol_id = p.id
       AND p.slug = NEW.slug
       AND (a.protocol_id <> NEW.id OR a.protocol_version <> NEW.version)
       AND a.status IN ('pending');

    v_due := now() + interval '14 days';

    -- Assign to every staff member whose role matches
    INSERT INTO public.compliance_protocol_assignments
      (protocol_id, protocol_version, staff_id, staff_user_id, status, assigned_at, due_at)
    SELECT NEW.id, NEW.version, sp.id, sp.user_id, 'pending', now(), v_due
      FROM public.staff_profiles sp
     WHERE sp.user_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = sp.user_id
           AND ur.role::text = ANY(NEW.applies_to_roles)
       )
    ON CONFLICT (protocol_id, protocol_version, staff_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_handle_compliance_publish
  AFTER INSERT OR UPDATE ON public.compliance_protocols
  FOR EACH ROW EXECUTE FUNCTION public.handle_compliance_protocol_publish();

-- ============ Helper: compute expires_at from protocol on insert ============
CREATE OR REPLACE FUNCTION public.set_compliance_signature_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_months int;
BEGIN
  IF NEW.expires_at IS NULL THEN
    SELECT renewal_months INTO v_months FROM public.compliance_protocols WHERE id = NEW.protocol_id;
    IF v_months IS NOT NULL AND v_months > 0 THEN
      NEW.expires_at := NEW.signed_at + (v_months || ' months')::interval;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_set_compliance_sig_expiry
  BEFORE INSERT ON public.compliance_signatures
  FOR EACH ROW EXECUTE FUNCTION public.set_compliance_signature_expiry();
