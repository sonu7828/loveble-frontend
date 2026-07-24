
-- NPP acknowledgment on client_profiles
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS npp_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS npp_version text;

-- Let patients file their own PHI deletion request (in addition to existing admin policies).
DO $$ BEGIN
  CREATE POLICY "Patients can file their own deletion request"
    ON public.phi_deletion_requests
    FOR INSERT TO authenticated
    WITH CHECK (lower(client_email) = public.current_client_email());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Patients can see their own deletion requests"
    ON public.phi_deletion_requests
    FOR SELECT TO authenticated
    USING (
      public.is_admin(auth.uid())
      OR lower(client_email) = public.current_client_email()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed HIPAA Basics 2026 compliance protocol.
-- The publish trigger will auto-assign to all matching staff.
INSERT INTO public.compliance_protocols (
  slug, title, category, summary, body_markdown,
  sections, version, renewal_months, requires_license,
  is_active, applies_to_roles, published_at
) VALUES (
  'hipaa-basics-2026',
  'HIPAA Basics 2026',
  'privacy_security',
  'Annual HIPAA Privacy & Security training. Required for all workforce members with access to PHI. Complete once per year.',
$$# HIPAA Basics 2026

## 1. What is PHI?
Protected Health Information (PHI) is any information about a patient that identifies them AND relates to their health, care, or payment. Names, dates of birth, phone numbers, email addresses, photos, chart notes, appointment history, and payment records are all PHI when tied to a patient.

## 2. Minimum Necessary
Only access the PHI you actually need to do your job. Do not look up friends, family, coworkers, celebrities, or your own record out of curiosity. Every chart view is logged.

## 3. Passwords, Devices & Workstations
- Never share your login. Every action is tied to your account.
- Lock your screen whenever you step away.
- Do not install unapproved apps on devices used to access PHI.
- Report a lost or stolen phone or laptop **immediately** to the Privacy Officer.

## 4. Communicating with Patients
- Do not text or email PHI from personal accounts.
- Only use the in-app messaging tools for clinical communication.
- Confirm identity before discussing any medical detail on the phone.

## 5. Photos
- Clinical photos require signed photo consent before capture.
- Never take clinical photos on your personal phone.
- Use the in-app camera flow; photos are watermarked and audit-logged.

## 6. Breach Reporting
If you suspect PHI has been exposed (lost device, wrong email recipient, unauthorized viewer, phishing click, misdirected fax) — **report within 24 hours** via **Report a possible breach** on the staff home page. Delay of reporting is itself a violation.

## 7. Sanctions
Willful violations (snooping, unauthorized disclosure, sharing credentials, deleting audit records) will result in disciplinary action up to and including termination and reporting to licensing boards.

## 8. Your Rights
You have the right to report concerns to the Privacy Officer without retaliation. Anonymous reports are accepted.

## Attestation
By signing below, I confirm I have read and understood the training above and agree to comply with all HIPAA Privacy & Security requirements at Radiantilyk Aesthetic.
$$,
  '[]'::jsonb,
  1, 12, false, true,
  ARRAY['staff','nurse_practitioner','admin','scheduler','receptionist']::text[],
  now()
)
ON CONFLICT (slug, version) DO NOTHING;
