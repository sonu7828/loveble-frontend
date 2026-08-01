My Profile & Clinical Credentials
Manage your personal details, professional credentials, clinical availability, digital signature, and Google Calendar sync.

Personal & Professional Info
Full name
Kiem Vukadinovic, NP
Title
Administrator
Email
admin@gmail.com
Updates sign-in email. You'll get a confirmation link.

Phone
(408) 555-0199
CA license # (NP/RN/MD)
NP-F 950210 (CA BRN)
Auto-fills on GFE and chart note signatures.

Clinical Availability Hours
San Jose Studio Schedule

Monday
09:00
-
17:00

Tuesday
09:00
-
17:00

Wednesday
09:00
-
17:00

Thursday
09:00
-
17:00

Friday
09:00
-
17:00

Saturday
09:00
-
15:00
Save changes & Availability
Google Calendar
Connect your Google Calendar so events on it automatically block booking slots.

Connect Google Calendar
Saved provider signature
Save your signature once and it will auto-fill every chart note you sign. You can always redraw it on the note if you want. Last updated August 1st, 2026.

Full legal name (as it should appear on notes)
Front Desk Receptionist
Draw your signature
Clear
Sign with your finger or Apple Pencil. Tap Clear to redo.

Save signature
Remove saved signatureVendor Hosting & Data Map
Radiantilyk Aesthetic — San Jose, CA
Prepared July 04, 2026 · Confidential — internal compliance reference
Purpose
This document maps every third-party vendor that stores, processes, or transmits Radiantilyk Aesthetic business or client data. For
each vendor: what data lives there, hosting region, encryption, retention, subprocessors, access controls, and BAA / HIPAA status.
Use this as the source of truth for HIPAA §164.308(b), §164.314(a), and OCR audit response.
Vendor Summary Matrix
Vendor
Role
Data Class
Lovable Cloud
(Supabase)
GoHighLevel
App DB, auth, storage, edge
fns
PHI + PII
CRM, SMS, email, reminders PHI + PII
Region
US-East (AWS us-east-1)
BAA
Enterprise req.
US (AWS us-east)
Add-on $297/mo
Stripe
Resend
Card processing, terminals
Transactional email (via
Lovable)
PCI (card), PII
PII (email, name)
US (multi-AZ)
N/A (PCI-DSS L1)
US (AWS us-east-1)
Twilio
SMS (via GHL)
Google (OAuth/Calendar) Staff calendar sync
PII + limited PHI
US
Available
Available
Staff PII, appt titles
Cloudflare
Lovable (hosting)
DNS, CDN, WAF
Frontend hosting, preview
Metadata only
US multi-region
Global edge
Workspace BAA
N/A
Public assets
Global CDN
Enterprise req.
Legend — Data Class: PHI = Protected Health Info (names + treatment/appt/clinical). PII = Personally Identifiable Info (name, phone, email). PCI =
Payment Card Info.
Lovable Cloud (Supabase-managed Postgres)
Role Primary application backend: Postgres database, authentication, file storage (photos, PDFs), edge functions.
Data stored Client profiles, appointments, clinical notes (neurotoxin/filler/energy/wellness), consent signatures, intake forms,
product lots, sales, PROMs, adverse events, staff records, PHI access logs.
Hosting region AWS us-east-1 (N. Virginia) — Supabase managed.
Encryption At rest: AES-256 (AWS EBS). In transit: TLS 1.2+. Storage bucket objects encrypted.
Access control Row Level Security on 110+ tables. Role-based via user_roles table + has_role() definer function. Service-role key
restricted to edge functions.
Auth Supabase Auth (email + Google OAuth). MFA available.
Retention Application-defined. PHI deletion requests handled via phi_deletion_requests table workflow. Clinical records retained
per CA §1300.68 (7 yrs adult / until 21 minor).
Audit logging phi_access_log, appointment_audit_log, clinical_audit_log, consent_pdf_audit, consent_validation_log.
Subprocessors AWS (compute/storage), Supabase Inc.
BAA / HIPAA Not covered on current Lovable plan. Requires Lovable Enterprise (sales@lovable.dev). Business $279/mo does
not include BAA.
Action required Contact Lovable Enterprise for signed BAA before storing PHI at scale.
GoHighLevel (GHL)
Role CRM, two-way SMS, marketing email, appointment reminders, pipeline automations.
Data stored Client name, phone, email, appointment date/time/service, reminder message content, tags, notes synced from app.
Hosting region AWS US (primarily us-east).
Encryption TLS 1.2+ in transit; AES-256 at rest.
Access control Sub-account isolation, agency-level admin, 2FA available (enable for all staff).
Retention Indefinite until manually deleted. Configure per HIPAA add-on data retention policy after BAA.
Audit logging Available only under HIPAA Compliance add-on (audit trail, access logs, session tracking).
Subprocessors Twilio (SMS), Mailgun/SendGrid (email), AWS.
BAA / HIPAA Current plan: Agency Unlimited $279/mo — NO BAA. Requires HIPAA Compliance add-on $297/mo (total ~$576/mo)
for signed BAA, ePHI encryption, MFA enforcement, restricted integrations.
Action required Purchase HIPAA add-on before sending appointment SMS/email containing client name + service details.
Stripe
Role Card processing (in-app checkout + Stripe Terminal readers), no-show fee capture, subscription/payment plans.
Data stored Card tokens (never raw PAN on our systems), payer name, billing address, transaction history, terminal reader IDs.
Hosting region US multi-region (Stripe managed).
Encryption PCI-DSS Level 1 certified. TLS 1.2+, HSM-backed key mgmt.
Access control Restricted API keys stored as Cloud secrets, dashboard SSO + 2FA.
Retention Financial records 7 yrs (IRS). Cardholder tokens retained for repeat charges/no-show fees.
Audit logging Stripe Dashboard event log; webhook events mirrored to webhook_events_processed table.
Subprocessors AWS, Google Cloud.
BAA / HIPAA Not required — payment data is not PHI when limited to billing. Do not put diagnosis/treatment detail in Stripe
metadata.
Action required Audit Stripe product/metadata fields — ensure no clinical descriptors leak into line items.
Resend (Lovable Emails)
Role Transactional email delivery: appointment confirmations, consent PDFs, receipts, auth emails. Sent via Lovable's
process-email-queue edge function.
Data stored Recipient email, subject, rendered HTML (may include appt time + service name), send status.
Hosting region AWS us-east-1.
Encryption TLS in transit, encrypted at rest.
Access control API key held in Lovable Cloud Vault; not exposed to browser.
Retention Send logs 30 days at Resend; email_send_log table retains indefinitely in our DB.
Audit logging email_send_log, suppressed_emails, email_unsubscribe_tokens.
Subprocessors AWS.
BAA / HIPAA Resend offers BAA on paid plan. Coverage flows through Lovable Enterprise BAA when signed.
Action required Verify BAA scope covers Resend when Lovable Enterprise is signed; otherwise strip service names from email
subjects.
Twilio (via GoHighLevel)
Role SMS carrier for all appointment reminders, two-way client texting, no-show notifications.
Data stored Sender/recipient phone numbers, message body, delivery status, timestamps.
Hosting region US (Twilio managed multi-region).
Encryption TLS 1.2+ in transit; AES-256 at rest.
Access control Managed indirectly through GHL sub-account; no direct Twilio console access.
Retention Twilio: message body 13 months (configurable). GHL mirrors indefinitely.
Audit logging GHL conversation log; app-side sms_send_log, sms_messages, ghl_reminder_log.
Subprocessors AWS, US wireless carriers.
BAA / HIPAA Twilio BAA is only valid when signed directly with Twilio or passed through GHL HIPAA add-on. Standard GHL plan
does not extend Twilio BAA.
Action required Same as GHL — HIPAA add-on required before any PHI-adjacent SMS.
Google (Workspace / OAuth / Calendar)
Role Staff Google Calendar two-way sync for appointments (staff_google_oauth table), Google sign-in for staff/clients.
Data stored Staff email, OAuth refresh tokens, calendar event titles (appt type + client first name), start/end times.
Hosting region Google multi-region.
Encryption TLS 1.2+ in transit; encrypted at rest with Google-managed keys.
Access control OAuth refresh tokens stored encrypted in staff_google_oauth (RLS: staff self-access only). Scopes limited to
calendar.events.
Retention Tokens rotated per Google policy; revoked on staff offboarding.
Audit logging staff_google_oauth updated_at + app-side event log via appointment_staff_calendar_events.
Subprocessors Google Cloud.
BAA / HIPAA Google Workspace BAA available (Business Plus+). Requires org admin acceptance in Workspace admin console.
Action required Ensure Workspace BAA is accepted; keep calendar event titles minimal (no diagnosis).
Cloudflare
Role DNS (bookrka.com, rkabook.lovable.app), CDN, TLS termination at edge, WAF/bot protection.
Data stored Request metadata: IPs, user agents, timings. No app payload cached for authenticated routes.
Hosting region Global edge (300+ POPs).
Encryption TLS 1.3 termination; origin re-encryption to Lovable hosting.
Access control Cloudflare dashboard SSO + 2FA.
Retention Analytics 30 days; logs per plan tier.
Audit logging Cloudflare audit log.
Subprocessors N/A (Cloudflare-owned network).
BAA / HIPAA Cloudflare BAA available on Enterprise plan; typically not required as no PHI traverses cacheable routes.
Action required Confirm no PHI in URL query strings (which get logged).
Lovable (Frontend Hosting)
Role Serves the React SPA at rkabook.lovable.app + custom domain bookrka.com.
Data stored Static assets only. No client data resides in the hosting layer.
Hosting region Global CDN.
Encryption TLS 1.3 in transit.
Access control Deploy access limited to workspace members with editor role.
Retention Build artifacts retained per Lovable platform policy.
Audit logging Lovable deployment history.
Subprocessors AWS, Cloudflare.
BAA / HIPAA Rolled into Lovable Enterprise BAA when signed.
Action required No PHI in bundle. Verified — client data fetched at runtime from Cloud.
Data Flow Summary
Below is the end-to-end path of a client appointment from booking to reminder to check-in, showing which vendor holds the data at
each step.
Step System of record Vendor(s) touched Data class
1. Client books on bookrka.com Cloud DB (appointments) Lovable hosting fi Cloud fi GHL sync PHI + PII
2. Confirmation email sent email_send_log Cloud fn fi Resend PII (+ service name)
3. Card on file captured Stripe Stripe (token) fi Cloud (customer_id) PCI
4. Reminder SMS 48h/24h ghl_reminder_log GHL fi Twilio fi carrier PII + limited PHI
5. Intake form completed client_intake_submissions Cloud DB PHI
6. Staff calendar sync appointment_staff_calendar_events Cloud fi Google Calendar Staff PII + appt
7. Visit + clinical note clinical_notes + subtables Cloud DB (RLS) PHI
8. Consent PDF signed consent_signatures + storage Cloud storage fi Resend (copy) PHI
9. Payment captured sales, sale_items Stripe fi Cloud webhook PCI + PII
10. Post-op check-in postop_checkins, prom_responses Cloud DB, GHL SMS PHI
Compliance Gaps — Action Items
# Item Action
1 Lovable Enterprise BAA Business $279/mo does not include BAA. Contact sales@lovable.dev to price Enterprise + BAA covering
Cloud, Resend, hosting.
2 GoHighLevel HIPAA add-on Add $297/mo HIPAA Compliance add-on to existing $279/mo Agency Unlimited plan. Request signed
BAA + enable MFA for all sub-account users.
3 Google Workspace BAA Confirm Workspace admin has accepted BAA (Admin console fi Account settings fi Legal &
Compliance).
4 Stripe metadata audit Review Stripe product names and metadata — remove any clinical descriptors; keep to service SKU only.
5 Cloudflare URL hygiene Ensure no query strings carry client identifiers or PHI (currently compliant — verify on next code review).
— End of report 



HIPAA Compliance Gap Assessment
Radiantilyk Aesthetic — San Jose, CA
Prepared for: Kiem Vukadinovic, NP & Founder  •  Medical Director: Dr. Aloysius N. Fobi, MD
Scope: EHR / booking platform, staff workflows, patient portal, e-signatures, PHI storage, marketing.
How to read this report
Each row maps to a HIPAA requirement (Privacy Rule 45 CFR §164.500-534, Security Rule §164.302-318, Breach
Notification §164.400-414). Status: Met = evidence exists in the app today, Partial = implemented but incomplete, Gap
= must be built or documented before you are defensible in an audit.
1. Administrative Safeguards (§164.308)
Requirement
Status What you have / What's missing
Security Officer
designation
(§164.308(a)(2))
Risk analysis
(§164.308(a)(1)(ii)(A))
Gap
Partial
No named HIPAA Security Officer or
Privacy Officer on file.
This document is a gap assessment. A
full, dated risk analysis covering all ePHI
systems is still required.
Action
Appoint Kiem (or delegate) as Security
& Privacy Officer in writing. Save
signed appointment letter.
Write a 1-page DR plan; perform a test
restore yearly and log the result.
Complete an annual written risk
analysis; store PDF in a compliance
folder and re-review yearly.
Workforce training
Sanction policy
Access management &
unique user IDs
Automatic logoff
Audit controls
(§164.312(b))
Business Associate
Agreements (BAAs)
Contingency plan /
backups
Partial
Gap
Met
Met
Met
Gap
Partial
Compliance module exists in-app (staff
signs protocols) but no HIPAA-specific
onboarding module.
No written policy for staff who violate
privacy rules.
Backend auth + user_roles table
(admin/staff) + separate staff logins.
useIdleLogout hook signs out staff after
15 min of inactivity.
phi_access_log + clinical_audit_log +
appointment_audit_log tables record
view/download/export.
Required with every vendor touching PHI:
Lovable Cloud (database host), any AI
provider used for scribe, SMS provider
(Twilio/GHL), email provider (Resend),
Stripe, Google (if Calendar syncs PHI).
Database has automated backups via
hosting; no written disaster-recovery plan
or restore test.
Add a HIPAA 101 protocol to
Compliance Admin; require signature
on hire and annually.
Publish a 1-page sanction policy
(verbal warning fi written fi
termination fi board report).
Keep. Review roles quarterly —
remove ex-staff same day.
Keep.
Review logs monthly; export to a
dated PDF quarterly for evidence.
Request & store signed BAA from
each vendor. Do NOT send PHI to any
vendor without one.
Requirement Status What you have / What's missing Action
Incident response plan Gap No written breach response procedure. Document who to call, 60-day breach
notification timeline (§164.404), and
HHS/OCR reporting steps.
2. Physical Safeguards (§164.310)
Requirement Status What you have / What's missing Action
Facility access controls Partial Physical clinic access assumed managed;
no written policy.
Document who has keys/alarm codes
and revocation on termination.
Workstation security Gap No written policy for iPad/laptop use,
screen lock, or public-Wi-Fi restrictions.
1-page workstation policy: screen lock
<=5 min, full-disk encryption on, no
PHI on personal devices.
Device & media
disposal
Gap No documented procedure for wiping
decommissioned devices.
Require factory-wipe + signed
disposal log for any device that
touched PHI.
3. Technical Safeguards (§164.312)
Requirement Status What you have / What's missing Action
Access control & RLS Met Row-Level Security enabled on PHI
tables (clinical_notes, gfe_records,
consents, photos, etc.) scoped by
has_role().
Re-run security scan after every
schema change.
Encryption in transit Met HTTPS on custom domains
(bookrka.com) + backend TLS.
Keep. Force HTTPS on any new
subdomain.
Encryption at rest Met Postgres + Storage encrypted at rest by
hosting.
Keep.
Multi-Factor
Authentication for staff
Partial StaffMfa page exists; MFA not enforced
for all staff accounts.
Turn MFA to required for every user
with the staff/admin role.
Password policy Partial Default auth password rules only. Enforce 12+ chars, block leaked
passwords (HaveIBeenPwned option
in auth settings).
Audit trail integrity Met Audit tables are append-only via RLS;
log_phi_access RPC used app-wide.
Do not add UPDATE/DELETE policies
on audit tables.
Transmission security
— SMS/email
Partial SMS reminders/consents may transit
through Twilio/GHL/Resend.
(a) Get BAAs. (b) Limit PHI in SMS
body to first name + appointment time.
Never diagnosis/med names in SMS.
Requirement
AI Scribe recordings
Status What you have / What's missing
Gap
New AI Scribe records audio and
generates SOAP notes. Audio + transcript
are PHI.
Action
(a) Explicit patient consent before
recording (already built — verify
shown every visit). (b) BAA with the AI
vendor. (c) Delete raw audio after
transcript is finalized, or retain in
scribe_sessions with RLS + retention
policy.
4. Privacy Rule (§164.500-534)
Requirement
Status What you have / What's missing
Action
Notice of Privacy
Practices (NPP)
Minimum necessary
standard
Gap
Met
No NPP appears to be posted to patients
or acknowledged at intake.
Role-scoped RLS limits which staff can
see which client data.
Publish NPP on website + intake flow;
capture acknowledgment signature
(reuse consents infrastructure).
Keep. Audit report of unsigned
patients before next visit.
Review staff role assignments
quarterly.
Patient right to access
records (§164.524)
Patient right to amend
(§164.526)
Accounting of
disclosures (§164.528)
Authorization for
marketing
Photo/video consent
Annual patient
acknowledgement
Partial
Gap
Partial
Partial
Met
Met
Patient portal shows own chart timeline,
receipts, treatment plans.
No workflow for patient-requested
amendments.
phi_access_log captures internal access;
external disclosures (referrals,
subpoenas) not tracked.
Newsletter subscribers table +
unsubscribe tokens exist.
photo_consent_records +
PhotoConsentDialog capture explicit
consent.
Mandatory annual acknowledgement
checkbox implemented in intake; valid 12
months, re-signed on next appt.
5. Breach Notification Rule (§164.400-414)
Requirement
Status What you have / What's missing
Add a one-click "Download my
complete record" export (PDF/ZIP) in
ClientAccount.
Add a simple request form in portal fi
routes to staff inbox fi addendum
recorded in clinical_note_addendums.
Add a disclosures table for
outside-the-clinic PHI sharing with
6-year retention.
Ensure marketing emails/SMS only go
to patients who explicitly opted in
(checkbox, not pre-checked). Store
consent timestamp.
Keep. Confirm consent required
before any social media use.
Action
Breach detection
Partial
Audit logs exist; no active
monitoring/alerting.
Add weekly review of phi_access_log
for anomalies (bulk exports, unusual
hours).
Requirement
60-day notification
Status What you have / What's missing
Gap
No template or process.
Action
Bake CMIA timing into the incident
response plan.
Template letters ready to send: (a)
affected patients, (b) HHS OCR (>500
fi immediate + media), (c) state AG
(CA CMIA).
California CMIA (state
law)
Gap
CA adds a 15-business-day patient
notification requirement, stricter than
federal.
Priority Action Plan — Next 30/60/90 Days
Do this week (blocking risk)
• Sign yourself as Security & Privacy Officer (one-page letter, dated).
• Get signed BAAs from: Lovable Cloud (database host), your AI Scribe provider, Twilio/GHL, Resend/email, Stripe.
Do not send PHI where no BAA is in place.
• Enforce MFA for every staff account.
• Confirm AI Scribe consent is displayed and captured on every recorded visit.
• Publish a Notice of Privacy Practices on bookrka.com and add an acknowledgment step to intake.
Within 30 days
• Write & sign: Sanction Policy, Workstation Security Policy, Device Disposal Policy, Incident Response Plan (incl.
CA CMIA 15-day & federal 60-day).
• Add HIPAA 101 protocol to Compliance Admin; require signature from every staff member.
• Enable password strength + leaked-password protection in auth settings.
• Restrict SMS/email PHI content to first name + appointment time only.
Within 60-90 days
• Build patient "Download my complete record" export in the portal.
• Build patient amendment request workflow.
• Add external disclosures tracking table (6-year retention).
• Run a disaster-recovery test restore; log the result.
• Schedule annual risk analysis for the same month each year.
Documentation retention
HIPAA requires 6 years retention (from creation or last effective date) for policies, risk analyses, training records,
BAAs, audit logs, and breach documentation. California medical records: minimum 7 years after last visit (or age 19 for
minors).
This assessment is a compliance planning aid based on the current app codebase and stated workflows. It is not a legal opinion. Have a
healthcare attorney review your final policies and BAAs before an audit


R ADIANTILYK AESTHETIC · CONFIDENTIAL — INTERNAL USE
HIPAA Gap Assessment
Comprehensive vendor-verified compliance review · Version 6.0
PREPARED FOR
Kiem Vukadinovic, NP ·
Founder & Privacy
Officer
SCOPE
All PHI systems, edge
functions, third-party
vendors
STANDARDS
HIPAA Security &
Privacy Rules · CA
CMIA
AUDIENCE
Development &
operations team
1. Executive Summary
Radiantilyk Aesthetic operates a HIPAA-covered medical aesthetics practice with a custom-built
Lovable Cloud application handling clinical charting, GFEs, consents, PROMs, appointment scheduling,
checkout, and internal messaging. This assessment is based on a code-level audit of every deployed
edge function and integration.
The application layer is fundamentally sound: TLS in transit, Postgres encryption at rest, Row-Level
Security on every PHI table, role-based access, break-glass audit, and a dedicated 
phi_access_log
.
The remaining risk is concentrated in three areas: (1) unsigned/unverified Business Associate
Agreements with third-party vendors, (2) missing administrative safeguards (formal risk analysis
approval, MFA enforcement, idle-timeout config), and (3) one production edge function currently
routing PHI through a non-BAA channel.
Overall posture: Technically strong, administratively incomplete. 3 Critical, 6 High, 5 Medium, 2 Low
findings identified. No evidence of a reportable breach.
Vendor inventory (verified from source code)
VENDOR
FUNCTION
Lovable Cloud
Lovable Emails
(notify.bookrka.com)
DB, auth, storage,
edge functions
PHI TOUCHED
All clinical & billing PHI
Transactional
email
(confirmations,
Name, appt time, service, receipt
BAA STATUS
COVERED
COVERED
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 1 of 12
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 2 of 12
VENDOR FUNCTION PHI TOUCHED BAA STATUS
receipts, OTP,
consent links)
GoHighLevel SMS reminders,
two-way SMS,
CRM sync
Name, appt time, service, phone UNVERIFIED
Brevo Marketing
campaigns + 1
internal VO alert
Marketing: no PHI · VO alert: client
name/region
NONE
Stripe Card processing,
terminal, receipts
Payment metadata linked to patient STANDARD BAA
AVAILABLE
Affirm Financing
(checkout links)
Name, amount, email VERIFY
Google Workspace Staff calendar,
staff email
Appointment metadata on staff
calendar
CLICK-ACCEPT
IN ADMIN
Cloudflare DNS, WAF, TLS
termination
Encrypted in transit only ENTERPRISE
BAA
OpenAI / Google (via
Lovable AI Gateway)
AI Scribe
transcription, note
drafting
Visit audio & transcript COVERED
UNDER
LOVABLE
Findings at a glance
ID SEVERIT
Y
TITLE HIPAA §
F-01 CRITICAL GoHighLevel BAA unverified — SMS carries appointment
PHI
§164.308(b)
F-02 CRITICAL VO on-call alert routes PHI through Brevo (no BAA) §164.308(b)
F-03 CRITICAL Risk Analysis template not populated / approved §164.308(a)(1)(ii)
(A)
F-04 HIGH MFA available but not enforced for admin/NP/provider
roles
§164.312(d)
F-05 HIGH Idle-session auto-logout hook exists but is not wired §164.312(a)(2)(iii)
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 3 of 12
ID SEVERIT
Y
TITLE HIPAA §
F-06 HIGH PHI access log retention policy not documented (6-year
rule)
§164.312(b),
§164.316(b)(2)
F-07 HIGH Incident-response runbook not published (breach UI exists) §164.308(a)(6)
F-08 HIGH Backup restore drills undocumented §164.308(a)(7)(ii)
(D)
F-09 HIGH Workforce sanctions policy not signed by staff §164.308(a)(1)(ii)
(C)
F-10 MEDIUM Google Workspace BAA not click-accepted in Admin
console
§164.308(b)
F-11 MEDIUM Annual HIPAA training register not populated for 2026 §164.308(a)(5)
F-12 MEDIUM Device & media inventory (staff phones/tablets) not tracked §164.310(d)
F-13 MEDIUM Audit log review cadence not scheduled §164.308(a)(1)(ii)
(D)
F-14 MEDIUM Notice of Privacy Practices acknowledgement not required
at intake
§164.520(c)
F-15 LOW Business continuity / disaster recovery plan not written §164.308(a)(7)
F-16 LOW Vendor annual re-review cadence not scheduled §164.308(b)(1)
2. Scope & Methodology
In scope: Radiantilyk Aesthetic's production application (booking, clinical, checkout, admin), every
deployed Supabase Edge Function, and every third-party vendor referenced in the codebase.
Methodology:
Source-code review of all edge functions under 
supabase/functions/
, including transactional email,
SMS, GHL sync, checkout, and safety alerts.
Database schema and RLS policy review across 110+ tables.
Vendor identification by grepping every outbound HTTP call and API key reference.
Mapping each control to HIPAA Security Rule §164.308–316 and California CMIA (Civ. Code §56 et
seq.).
Confirmed by user (Kiem Vukadinovic): Brevo is marketing-only; GoHighLevel handles SMS; Lovable
Emails handles all client-facing transactional email; no separate hosting/receipt vendor is used.
3. PHI Data Flow Map
1. Intake & booking — Client submits intake and books appointment 
→
 written to 
appointments
,
client_intake_submissions
, 
client_profiles
. Confirmation email & receipt sent via Lovable Emails
(BAA-covered).
2. Reminders — Appointment reminders sent via GoHighLevel SMS. PHI = name + appointment time +
service.
3. Clinical visit — GFE, consents, chart notes, photos captured. Photos in Lovable Cloud Storage;
charts in Postgres with RLS.
4. AI Scribe (optional) — Visit audio uploaded to Lovable Cloud Storage 
→
 transcribed via Lovable AI
Gateway 
→
 auto-deleted after 30 days.
5. Safety alerts — VO protocol triggers an internal email to on-call NPs. Currently routed through
Brevo — this is F-02.
6. Checkout — Stripe (card + terminal). Receipt via Lovable Emails.
7. Marketing — Brevo campaigns to opted-in subscribers. No PHI in payload; segmentation by
treatment category is generic.
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 4 of 12
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 5 of 12
CRITICAL
CRITICAL
CRITICAL
4. Detailed Findings
F-01 · GoHighLevel BAA unverified
HIPAA §164.308(b)(1) Business Associate Contracts · CMIA §56.10
RISK Every appointment reminder, no-show follow-up, and two-way SMS
conversation includes patient name, appointment time, and service booked — this is PHI. Without
an executed BAA and confirmation of GHL's HIPAA-compliant plan, this is a reportable disclosure
to an unauthorized business associate.
EVIDENCE
ghl-reminder-send
, 
ghl-sms-send
, 
ghl-sms-inbound
, 
ghl-sync-*
 functions
call GHL's API with PHI in message bodies.
REMEDIATION Confirm the workspace is on GHL's HIPAA-compliant plan and request/execute
their BAA. See companion document BAA Acquisition Guide. Until confirmed, restrict SMS content
to "Radiantilyk: Your appointment is confirmed" without patient name or service.
F-02 · VO on-call alert routes PHI through Brevo
HIPAA §164.308(b)(1) · §164.502(e)
RISK The 
vo-alert-oncall
 edge function sends an email containing client name,
region, and product to on-call nurse practitioners via Brevo (marketing platform, no BAA). This is
PHI leaving the covered entity through a non-BA channel.
EVIDENCE
supabase/functions/vo-alert-oncall/index.ts
 — POSTs to 
connector
gateway.lovable.dev/brevo/smtp/email
 with client_name and region in the HTML body.
REMEDIATION Reroute this single function to Lovable Emails (BAA-covered). Estimated
developer effort: 15 minutes. This is the fastest critical win.
F-03 · Risk Analysis template not populated or approved
HIPAA §164.308(a)(1)(ii)(A)
RISK The Security Rule's foundational requirement is a documented risk analysis. The
HIPAA policy templates now live in 
/staff/hipaa-policies
, but the Risk Analysis template is empty
and unsigned. Without it, no downstream safeguard is defensible in an audit.
REMEDIATION Populate the Risk Analysis template using the findings from this document,
obtain Privacy Officer approval, and mark the policy version approved in the app.
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 6 of 12
HIGH
HIGH
HIGH
HIGH
F-04 · MFA available but not enforced for privileged roles
HIPAA §164.312(d) Person or entity authentication
RISK Lovable Cloud MFA is available and 
/staff/mfa
 exists, but there is no gate
blocking admin, nurse_practitioner, or provider roles from accessing clinical routes without
enrolling MFA. Password-only access to PHI is not defensible.
REMEDIATION Add a 14-day grace-period MFA enrollment gate in 
StaffLayout
. Block clinical
routes for privileged roles that have not enrolled after grace period.
F-05 · Idle-session auto-logout not wired
HIPAA §164.312(a)(2)(iii) Automatic logoff
RISK
useIdleLogout
 hook exists but is not mounted in the staff shell. An unattended
workstation stays authenticated indefinitely.
REMEDIATION Mount the hook in 
StaffLayout
 with a 15-minute idle timeout and a 60-second
warning modal.
F-06 · PHI access log retention not documented
HIPAA §164.312(b) Audit controls · §164.316(b)(2) 6-year retention
RISK
phi_access_log
 and 
clinical_audit_log
 capture reads/writes, but there is no
documented retention SLA. HIPAA requires 6 years.
REMEDIATION Document a 6-year retention policy in the HIPAA policy pack. Add a scheduled
job that archives (not deletes) logs older than 90 days to cold storage.
F-07 · Incident-response runbook not published
HIPAA §164.308(a)(6) Security incident procedures · CMIA §56.36
RISK The 
/staff/breach
 UI exists to file breach reports, but the underlying runbook
(who to call, when to notify OCR, when to notify the California AG, patient-notification templates) is
not written. CMIA requires notification to affected patients AND the California AG
within 15 BUSINESS DAYS of discovery — stricter than federal HIPAA's 60 days.
REMEDIATION Populate the "Security Incident Response" policy template with a step-by-step
runbook. Include the CMIA 15-day countdown as an automated timer in 
breach_reports
.
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 7 of 12
HIGH
HIGH
MEDIUM
MEDIUM
F-08 · Backup restore drills undocumented
HIPAA §164.308(a)(7)(ii)(D) Testing and revision procedures
RISK Supabase Point-in-Time Recovery is enabled, but no restore drill has been
performed and documented. A backup that has never been restored is not a backup.
REMEDIATION Perform a quarterly restore drill to a staging environment. Document the
RTO/RPO and file in the Contingency Plan policy.
F-09 · Workforce sanctions policy not signed
HIPAA §164.308(a)(1)(ii)(C) Sanction policy
RISK The Sanctions policy template exists but has not been signed by workforce
members. Enforcement of PHI-handling violations is not documented.
REMEDIATION Push the sanctions policy through 
/staff/compliance
 assignment flow. Require
signature at hire and annually.
F-10 · Google Workspace BAA not click-accepted
HIPAA §164.308(b)(1)
RISK Staff calendar events created via 
google-calendar-*
 functions store
appointment metadata (patient name + time) on Google Calendar. Google offers a click-accept
BAA in the Workspace Admin console under Account > Legal & compliance > Security and
privacy additional terms.
REMEDIATION Log in as Workspace superadmin and accept the BAA. Store the acceptance
timestamp in 
vendors
.
F-11 · 2026 HIPAA training register empty
HIPAA §164.308(a)(5)
REMEDIATION Assign the "Annual HIPAA Awareness" compliance protocol to every workforce
member with a 30-day due date. The compliance module already tracks completion.
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 8 of 12
MEDIUM
MEDIUM
MEDIUM
LOW
LOW
F-12 · Device & media inventory not tracked
HIPAA §164.310(d) Device and media controls
REMEDIATION Add a device inventory (staff phones, iPads, laptops) with owner, serial,
encryption state, and disposal date. Require full-disk encryption and screen-lock on every device
that touches PHI.
F-13 · Audit log review cadence not scheduled
HIPAA §164.308(a)(1)(ii)(D)
REMEDIATION Set a monthly recurring task for the Privacy Officer to review 
phi_access_log
anomalies via 
/staff/audit-report
. Document findings.
F-14 · Notice of Privacy Practices acknowledgement not required at intake
HIPAA §164.520(c)
REMEDIATION Add an NPP acknowledgement checkbox to 
ClientIntake.tsx
. Store npp_acknowledged_at
 on the intake submission.
F-15 · Business continuity plan not written
HIPAA §164.308(a)(7)
REMEDIATION Draft a one-page BC/DR document covering: primary/backup providers, contact
tree, degraded-mode SMS scripts, paper-chart fallback, and RTO/RPO targets.
F-16 · Vendor annual re-review cadence not scheduled
HIPAA §164.308(b)(1)
REMEDIATION Add a yearly recurring review of every vendor's BAA and security posture on
the 
/staff/vendors
 page.
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 9 of 12
5. HIPAA Security Rule Compliance Matrix
STANDARD IMPLEMENTATION STATUS RELATED
§164.308(a)(1) Security
Management
Risk analysis template, risk mgmt policy,
sanctions, activity review
PARTIAL F-03, F-06,
F-09
§164.308(a)(2) Assigned
Responsibility
Kiem Vukadinovic = Privacy & Security Officer
(document formally)
GAP —
§164.308(a)(3)
Workforce Security
user_roles
 + 
has_role()
;
onboarding/termination checklist needed
PARTIAL F-04
§164.308(a)(4) Info
Access Mgmt
RLS + role-based policies enforced on every
PHI table
COMPLIANT —
§164.308(a)(5)
Awareness & Training
Compliance module exists; 2026 register
empty
GAP F-11
§164.308(a)(6) Incident
Procedures
Breach report UI present; runbook missing PARTIAL F-07
§164.308(a)(7)
Contingency Plan
Lovable Cloud PITR + daily backup; drill
undocumented
PARTIAL F-08, F-15
§164.308(b) Business
Associate Contracts
BAAs pending/unverified with GHL, Brevo,
Affirm
GAP F-01, F-02
§164.310(a) Facility
Access
Cloud-hosted; physical clinic controls
maintained separately
INFO —
§164.310(d) Device &
Media Controls
No device inventory yet GAP F-12
§164.312(a) Access
Control
Auth + RLS + break-glass; idle timeout not
wired
PARTIAL F-05
§164.312(b) Audit
Controls
phi_access_log
 + 
clinical_audit_log
;
retention undocumented
PARTIAL F-06, F-13
§164.312(c) Integrity Postgres constraints + audit triggers COMPLIANT —
§164.312(d) Person
Authentication
Email+password + MFA available; MFA not
enforced
PARTIAL F-04
STANDARD
IMPLEMENTATION
§164.312(e) Transmission
Security
§164.316 Documentation
TLS 1.2+ everywhere via Cloudflare + Lovable
Cloud
STATUS
RELATED
COMPLIANT —
Policy templates exist; approvals pending
PARTIAL
6. California CMIA Addendum
F-03
CMIA (Cal. Civ. Code §56 et seq.) applies to Radiantilyk as a California-licensed medical provider and is
stricter than federal HIPAA in three ways:
1. Breach notification within 15 business days — Affected patients and the California Attorney
General must be notified within 15 business days of discovery, versus HIPAA's 60 days.
2. Patient access requests — Records must be made available for inspection within 15 days and
copies delivered within 30 days.
3. Marketing authorization — Explicit written authorization is required for any marketing use of PHI
beyond direct treatment reminders.
Recommendation: Encode these SLAs as automated countdown timers on 
breach_reports
 and
phi_deletion_requests
. Gate 
marketing_campaigns.send
 on a valid 
marketing_consent_at
 flag on
newsletter_subscribers
.
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 10 of 12
7. Remediation Roadmap
Phase 1 — Critical (this week)
F-02: Reroute 
vo-alert-oncall
 from Brevo to Lovable Emails (~15 min).
F-01: Contact GoHighLevel; upgrade to HIPAA plan and execute BAA (see companion BAA
Acquisition Guide).
F-03: Populate and approve the Risk Analysis policy in 
/staff/hipaa-policies
.
Phase 2 — High (next 2 weeks)
F-04: Enforce MFA gate for admin/NP/provider roles in 
StaffLayout
.
F-05: Wire 
useIdleLogout
 with 15-min timeout + warning modal.
F-07: Publish incident-response runbook with CMIA 15-day countdown.
F-08: Perform and document backup restore drill.
F-09: Push sanctions policy through compliance signature flow.
F-06: Document 6-year retention and add cold-archive job for logs > 90 days.
Phase 3 — Medium (next 30 days)
F-10: Accept Google Workspace BAA in Admin console.
F-11: Assign 2026 HIPAA Awareness training to every workforce member.
F-12: Build device & media inventory in 
/staff/vendors
 or a new page.
F-13: Schedule monthly audit-log review.
F-14: Add NPP acknowledgement checkbox to client intake.
Phase 4 — Low (next quarter)
F-15: Draft one-page BC/DR plan.
F-16: Add annual vendor re-review reminders.
8. Sign-off
Privacy Officer: 
Kiem Vukadinovic, NP
Assessment version: 6.0
Next review: 
October 4, 2026
Medical Director: 
Assessment date: 
Classification: 
Dr. Aloysius N. Fobi, MD
July 4, 2026
Confidential — Internal Use
This assessment is a technical and administrative gap review for internal remediation planning. It is not legal advice and
is not a formal certification. Formal HIPAA/CMIA compliance attestation requires review by qualified privacy counsel and,
Radiantilyk Aesthetic · HIPAA Gap Assessment v6 · Confidential — Internal Use · Page 11 of 12
where applicable, third-party auditors
