
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.hipaa_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT,
  body_markdown TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  effective_date DATE,
  review_due_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hipaa_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.hipaa_policies(id) ON DELETE CASCADE,
  version INT NOT NULL,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  summary TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hipaa_policies TO authenticated;
GRANT ALL ON public.hipaa_policies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hipaa_policy_versions TO authenticated;
GRANT ALL ON public.hipaa_policy_versions TO service_role;

ALTER TABLE public.hipaa_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hipaa_policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view policies" ON public.hipaa_policies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage policies" ON public.hipaa_policies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Staff can view policy versions" ON public.hipaa_policy_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage policy versions" ON public.hipaa_policy_versions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_hipaa_policies_updated
  BEFORE UPDATE ON public.hipaa_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.hipaa_policies (slug, title, category, summary, body_markdown) VALUES
('privacy-policy','HIPAA Privacy Policy','Privacy','Governs uses and disclosures of PHI, patient rights, and minimum necessary standard.',
$$# HIPAA Privacy Policy

## 1. Purpose
Establish standards for the use and disclosure of Protected Health Information (PHI) at Radiantilyk Aesthetic in accordance with 45 CFR Part 164, Subpart E.

## 2. Scope
Applies to all workforce members, contractors, and business associates with access to PHI.

## 3. Policy
- PHI is used or disclosed only for Treatment, Payment, or Healthcare Operations (TPO), or with valid patient authorization.
- The **Minimum Necessary** standard applies to all non-TPO disclosures.
- Patients have the right to access, amend, and receive an accounting of disclosures of their PHI.
- Notice of Privacy Practices (NPP) is provided at first service and posted on the website.

## 4. Procedures
1. Verify identity before disclosing PHI (photo ID or two verifiers).
2. Log all non-TPO disclosures in phi_access_log.
3. Route patient rights requests to the Privacy Officer within 30 days.
4. Escalate suspected impermissible disclosures via the Breach Report tool.

## 5. Responsibility
Privacy Officer: Kiem Vukadinovic, NP.

## 6. Enforcement
Violations may result in sanctions up to termination and, where applicable, civil/criminal penalties under HIPAA.$$),

('security-policy','HIPAA Security Policy','Security','Administrative, physical, and technical safeguards for ePHI.',
$$# HIPAA Security Policy

## 1. Purpose
Protect the confidentiality, integrity, and availability of electronic PHI (ePHI) per 45 CFR Part 164, Subpart C.

## 2. Administrative Safeguards
- Annual risk analysis and risk management plan.
- Workforce security clearance, training, and sanctions.
- Contingency plan (backup, DR, emergency mode).

## 3. Physical Safeguards
- Facility access controls; visitor log at the clinic.
- Workstation use policy; auto-lock after 5 minutes idle.
- Device and media disposal via certified wipe/shred.

## 4. Technical Safeguards
- Unique user IDs, MFA for all staff.
- AES-256 at rest, TLS 1.2+ in transit.
- Audit logs: phi_access_log, clinical_audit_log, appointment_audit_log.
- Automatic logoff after 15 minutes idle.

## 5. Responsibility
Security Officer: Kiem Vukadinovic, NP.$$),

('breach-notification','Breach Notification Policy','Breach','Detect, assess, document and report breaches of unsecured PHI.',
$$# Breach Notification Policy

## 1. Definitions
A **breach** is an impermissible use/disclosure of unsecured PHI that compromises its security or privacy.

## 2. Discovery & Reporting
- Any workforce member who suspects a breach must file a Breach Report within 24 hours via /staff/breach-report.
- Privacy Officer completes a 4-factor risk assessment within 5 business days.

## 3. Notifications
- **Individuals**: written notice within 60 days.
- **HHS**: within 60 days (>= 500 individuals) or annually (< 500).
- **Media**: for breaches affecting > 500 residents of a state.

## 4. Documentation
Retain breach records and risk assessments for 6 years in breach_reports.$$),

('access-control','Access Control Policy','Security','Role-based access, provisioning, and de-provisioning of user accounts.',
$$# Access Control Policy

## 1. Principles
- Least privilege and need-to-know.
- Role-based access via user_roles (owner, admin, provider, front_desk).
- No shared accounts.

## 2. Provisioning
Requests approved by Admin; MFA enforced on first login.

## 3. Review
Admin reviews access quarterly and after any role change.

## 4. Termination
Access disabled within 1 hour of separation; keys/badges recovered same day.$$),

('workforce-training','Workforce Training & Awareness','Administrative','Onboarding and annual HIPAA training for all workforce.',
$$# Workforce Training Policy

## 1. Requirements
- HIPAA training within 30 days of hire, then annually.
- Role-specific training for clinical, front-desk, and admin staff.
- Ad-hoc training after material policy changes or incidents.

## 2. Records
Signatures and completion dates tracked in compliance_signatures.$$),

('sanctions','Sanctions Policy','Administrative','Disciplinary actions for HIPAA violations.',
$$# Sanctions Policy

## 1. Scope
All workforce members and contractors.

## 2. Tiers
- **Tier 1** — inadvertent: coaching + retraining.
- **Tier 2** — negligent: written warning + suspension.
- **Tier 3** — willful: termination + legal referral.

## 3. Documentation
All sanctions recorded in the workforce member's file and in the compliance audit log.$$),

('incident-response','Security Incident Response','Security','Detection, containment, eradication, and recovery from security incidents.',
$$# Incident Response Policy

## 1. Phases
1. **Detect** — alerts, user reports, audit review.
2. **Contain** — isolate affected accounts/devices.
3. **Eradicate & Recover** — remove threat, restore from backup if needed.
4. **Post-Incident** — root cause, lessons learned, policy updates.

## 2. Roles
- Incident Commander: Security Officer
- Communications: Privacy Officer
- Technical Lead: IT/Engineering on-call$$),

('contingency-plan','Contingency Plan (Backup & DR)','Security','Data backup, disaster recovery, and emergency mode operations.',
$$# Contingency Plan

## 1. Data Backup
- Daily automated database snapshots retained 30 days.
- Weekly off-region backup retained 12 months.

## 2. Disaster Recovery
- RTO: 8 hours. RPO: 24 hours.
- Annual restore test with signed attestation.

## 3. Emergency Mode
Paper downtime forms for scheduling, consents, and chart notes; entered into EMR within 48 hours of restoration.$$),

('data-retention','Data Retention & Disposal','Privacy','Retention schedules for PHI and secure disposal.',
$$# Data Retention & Disposal Policy

## 1. Retention
- Medical records: 7 years after last encounter (CA: minors — until age 25).
- Consents: life of relationship + 7 years.
- Audit logs: 6 years.

## 2. Disposal
- Electronic: cryptographic erase or NIST 800-88 wipe.
- Paper: cross-cut shred by certified vendor.$$),

('baa-management','Business Associate Agreement Management','Administrative','BAA execution, tracking, and renewal for all PHI vendors.',
$$# BAA Management Policy

## 1. Requirement
Every vendor that creates, receives, maintains, or transmits PHI on our behalf must have an executed BAA before access.

## 2. Registry
Maintained in /staff/vendors. Review at least annually.

## 3. Renewal
Reminders 60 days before expiration; suspend data flow if lapsed.$$),

('risk-analysis','Risk Analysis & Management','Security','Periodic risk assessment covering threats, vulnerabilities, and controls.',
$$# Risk Analysis Policy

## 1. Frequency
- Full assessment annually.
- Focused assessment after material system, staffing, or vendor changes.

## 2. Method
Aligned with NIST SP 800-30. Documents: asset inventory, threat/vulnerability list, likelihood/impact scoring, control gaps, remediation plan.

## 3. Output
Report signed by Security Officer; remediation tracked to closure.$$),

('audit-controls','Audit Controls & Monitoring','Security','Logging, review, and alerting on ePHI activity.',
$$# Audit Controls Policy

## 1. Logging
phi_access_log, clinical_audit_log, appointment_audit_log, consent_email_log capture actor, action, resource, timestamp.

## 2. Review
- Weekly: after-hours access review.
- Monthly: high-volume access, break-glass events, exports.
- Quarterly: role/permission review.

## 3. Alerts
Automated alerts on repeated failed logins, bulk exports, and after-hours PHI access.$$),

('byod-mobile','BYOD & Mobile Device','Security','Personal devices accessing PHI must meet security baseline.',
$$# BYOD & Mobile Device Policy

## 1. Baseline
- Device passcode >= 6 chars, biometric enabled.
- Full-device encryption on.
- OS current within 1 major version.
- Remote wipe capability (MDM enrollment).

## 2. Use
- No screenshots of PHI to personal cloud.
- No PHI over personal SMS or email.
- Report lost/stolen devices within 1 hour to the Security Officer.$$);
