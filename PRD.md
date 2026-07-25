# Product Requirement Document (PRD)

## Radiantilyk Aesthetic — Healthcare, EMR & Practice Management System

**Version**: 4.0 (Fresh Implementation Blueprint — Zero Cloud Vendor Lock-In)  
**Last Updated**: July 24, 2026  
**Practice Name**: Radiantilyk Aesthetic (San Jose, CA)  
**Privacy & Security Officer**: Kiem Vukadinovic, NP & Founder  
**Medical Director**: Dr. Aloysius N. Fobi, MD  
**Product Type**: Full-Stack Medical Aesthetic EMR & Practice Management System  
**Domain**: Healthcare (Aesthetic Medicine, Dermatology, Medical Spa)  
**Target Compliance Standard**: Designed for HIPAA-aligned (45 CFR §164) & California CMIA-aligned (Cal. Civ. Code §56 et seq.) implementation  

---

> [!IMPORTANT]
> **DISCLAIMER ON COMPLIANCE:**  
> This application is **designed for HIPAA-aligned and California CMIA-aligned implementation**. Software architecture alone does not constitute formal certification or legal compliance. Full regulatory compliance depends on:
> 1. Executed Business Associate Agreements (BAAs) with third-party vendors.
> 2. Documented administrative, physical, and technical safeguards.
> 3. Standard operating procedures (SOPs) and workforce training.
> 4. Periodic third-party security audits and risk assessments.

---

## 1. Executive Summary & Context

Radiantilyk Aesthetic is a custom-built medical aesthetics EMR and practice management system designed for a clinical practice in San Jose, CA. It powers client acquisition, multi-step appointment scheduling, clinical SOAP charting, Good Faith Estimates (GFE), electronic consent signatures, Patient-Reported Outcome Measures (PROMs), inventory burn tracking, Stripe POS checkout, and practice administration.

### Architecture Transition Summary
- **Supabase Backend Removed**: The backend architecture is completely decoupled from Supabase.
- **Fresh Implementation**: Node.js + Express + TypeScript REST API backend built from scratch.
- **Single Source of Schema**: Database models defined natively using **Prisma ORM** targeting **PostgreSQL 16**.
- **State & Storage**: Redis (sessions, caching, BullMQ background queues) + AWS S3 (encrypted file storage).

---

## 2. User Roles & Access Hierarchy

| Role Code | Display Name | Permissions & Scope |
|-----------|--------------|---------------------|
| `admin` | Practice Owner / Admin | Full operational access across all practice locations, reporting, team management, vendors |
| `medical_director` | Medical Director (Dr. Fobi, MD) | Clinical oversight, Cosign Queue approval, protocol authoring, safety alert reviews |
| `nurse_practitioner` | Nurse Practitioner (Kiem, NP) | Independent clinical charting, GFE generation, protocol execution, cosigning, safety hub |
| `staff` | RN / Injector / Aesthetician | Patient care, SOAP charting (requires cosign), clinical photos, lot burn, appointments |
| `scheduler` | Scheduler | Calendar management, booking approvals, waitlist, client schedule coordination |
| `receptionist` | Front Desk / Reception | Patient check-in, checkout POS, card-on-file entry, intake/consent verification |
| `privacy_officer` | Privacy & Security Officer | HIPAA/CMIA policy management, breach reporting, PHI access logs, BAA verification |
| (patient auth) | Patient | Public booking, patient portal (`/account`), intake, consents, photos, feedback |

---

## 3. Infrastructure & Third-Party Vendor Architecture

All third-party services that transmit, store, or process client data must be governed by executed BAAs prior to processing ePHI.

| Component / Vendor | Role in System | Data Held | BAA / Compliance Target | Routing & Policy |
|-------------------|----------------|-----------|-------------------------|------------------|
| **AWS RDS PostgreSQL** | Primary Database | All Application Data & PHI | BAA Required | Encrypted at rest (AES-256) |
| **AWS S3** | Encrypted Object Storage | Documents, Photos, Consents, Audio | BAA Required | Presigned URLs (No public URLs) |
| **AWS SES / Resend** | Transactional Email (`notify.bookrka.com`) | Name, Appt Time, Service, Receipts, OTP | BAA Required | Client emails + Urgent VO Alerts |
| **GoHighLevel / Twilio** | Two-Way SMS & Reminders | Name, Phone, Appt Time | BAA Required | Minimal PHI in message bodies |
| **Stripe** | Credit Card & Terminal POS | Card Tokens, PII, Amounts | PCI-DSS Level 1 | PCI compliant (No PHI in metadata) |
| **Google Workspace** | 2-Way Staff Calendar Sync | Staff Email, Appt Metadata | BAA Click-Accept | Minimal titles (No diagnosis) |
| **Affirm** | Patient Checkout Financing | Customer PII, Amount | Financial Agreement | Optional financing link |
| **Redis / BullMQ** | Sessions, Caching, Queue | Session Tokens, Job Data | Self-Hosted / Encrypted | Ephemeral data, encrypted |
| **Brevo** | Marketing Email Campaigns | Subscriber Email, Opt-in | ❌ NO BAA (Marketing ONLY) | **STRICTLY NO PHI** |

---

## 4. Regulatory & Legal Safeguards (HIPAA & California CMIA)

### 4.1 California CMIA Specific Standards (Cal. Civ. Code §56 et seq.)
1. **Breach Notification Timeline**: Notification to affected patients and the California Attorney General must occur within **15 business days** of discovery (stricter than federal HIPAA's 60 days).
2. **Patient Access Timelines**: Right to inspect medical records within **15 days**; right to receive copies within **30 days**.
3. **Marketing Authorization**: Explicit written consent with timestamp (`marketing_consent_at`) required before sending promotional messages.
4. **Medical Record Retention**: Clinical records must be retained for at least **7 years** from the last treatment date (CA §1300.68). Minors: Retained for 7 years or until age 19, whichever is longer.
5. **Patient Amendments**: Workflow to record patient-requested record corrections via attached addendums (`note_addendums`), preserving original note immutability.

### 4.2 Audit & Governance Controls
- **Accounting of Disclosures**: 6-year retention tracking for external PHI disclosures (`external_disclosures`).
- **PHI Deletion Workflow**: Handled via `phi_deletion_requests` balancing privacy requests against mandatory 7-year retention.
- **AI Scribe Audio Retention**: Raw voice recordings in S3 automatically purged after **30 days** (`scribe_sessions`); final transcript & SOAP note retained in DB.

---

## 5. Core Modules Overview

### 5.1 Public Website & Booking Platform (17 Pages)
- **Routes**: `/`, `/services`, `/services/:slug`, `/faq`, `/quiz`, `/journal`, `/journal/:slug`, `/model`, `/san-jose`, `/everesse`, `/reviews`, `/privacy`, `/privacy-practices`, `/terms`, `/unsubscribe`.
- **Multi-Step Booking Wizard (`/book`)**:
  1. Service Selection (Catalog + Add-ons)
  2. Location & Staff Selection (San Jose clinic)
  3. Date & Time Selection (Real-time slots)
  4. Patient Information (Matches or creates profile)
  5. Consents & Deposit Payment (Stripe / Affirm)

### 5.2 Patient Portal (`/account`)
- **Tabs**: Dashboard, Appointments, Consents, Medical Records (Timeline, Plans, Post-Op Check-Ins), Receipts, Profile, Security.
- **One-Click Export**: Download complete medical record as PDF/ZIP.
- **Amendment Requests**: Patient portal UI to request chart corrections.

### 5.3 Staff Portal & Practice Management (29 Pages)
- **Today Dashboard (`/staff/today`)**: Daily KPI metrics, status pipeline (`pending` → `confirmed` → `checked_in` → `in_progress` → `completed`), Start Visit Guided Flow.
- **Inbox & Messaging (`/staff/inbox`, `/staff/messages`)**: Booking approvals, waitlist management, two-way SMS log.
- **Calendar & Schedule (`/staff/calendar`, `/staff/my-schedule`)**: Multi-provider calendar, 2-way Google sync, availability, time-off requests.
- **Client Management (`/staff/clients`)**: Client 360 profile, cards on file, ID documents, treatment history, saved signatures, clinical alerts.
- **Checkout POS (`/staff/checkout`)**: Service line items, tips, discounts, Stripe Terminal card charging, Affirm link, automatic lot burn, receipts.

### 5.4 Clinical Module & EMR (11 Pages)
- **SOAP Chart Note Editor (`/staff/clinical/notes/:id`)**:
  - Subjective, Objective (Fitzpatrick scoring), Assessment, Plan.
  - AI Scribe voice dictation integration.
  - Injectable Treatment Record (Toxin/Filler lot picker, unit grid, face mapping).
  - Toxin Guardrails validation engine (`toxGuardrails.ts`).
  - Draft autosave every 30 seconds.
- **Cosign Queue (`/staff/clinical/cosign`)**:
  - RN Injector notes routed to `pending_cosign`.
  - Medical Director (Dr. Fobi) or NP (Kiem) review & signature.
  - Status transition to `signed` → `locked` (immutable forever).
- **Good Faith Estimate (`/staff/clinical/gfe`)**: No Surprises Act compliance, itemized cost estimates, digital signature capture.

### 5.5 Compliance & Audit Module (8 Pages)
- **Security Officer Dashboard (`/staff/security-officer`)**: Risk assessment metrics, vendor BAA tracking, device inventory.
- **Breach Management (`/staff/breach-report`)**: Incident filing, CMIA 15-business-day automated countdown timer, patient & CA AG notification logs.
- **PHI Audit Trail (`/staff/audit`)**: Append-only log of every PHI access, view, update, export, and deletion attempt.

---

## 6. Technical Stack Specification

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18.3 + Vite 5.4 + TypeScript 5.8 | SPA UI Layer (Port 5173) |
| **Backend API** | Node.js + Express + TypeScript | REST API Gateway (Port 5000) |
| **ORM** | Prisma ORM | Single Source of Schema Truth |
| **Database** | PostgreSQL 16 (AWS RDS) | Encrypted Relational Database |
| **Cache & Queue** | Redis + BullMQ | Sessions, Token Store, 13 Job Queues |
| **File Storage** | AWS S3 (4 Encrypted Buckets) | Document & Photo Management |
| **Payments** | Stripe API + Stripe Terminal | PCI-DSS L1 Card Processing |

---

*This PRD v4.0 specifies the complete functional requirements for Radiantilyk Aesthetic.*
