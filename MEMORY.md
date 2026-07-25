# Radiantilyk Development Rules & AI Guidelines

**Version**: 3.0 (Fresh Backend Architecture — Zero Vendor Lock-In)  
**Last Updated**: July 24, 2026  
**Practice**: Radiantilyk Aesthetic (San Jose, CA)  
**Privacy & Security Officer**: Kiem Vukadinovic, NP & Founder  
**Medical Director**: Dr. Aloysius N. Fobi, MD  
**Target Compliance Standard**: Designed for HIPAA-aligned & California CMIA-aligned implementation  

---

> [!IMPORTANT]
> **COMPLIANCE DISCLAIMER & MANDATE:**
> This software is **designed for HIPAA-aligned and California CMIA-aligned implementation**. Full regulatory compliance depends on executed Business Associate Agreements (BAAs) with vendors, written policies, staff training, operational procedures, and regular security testing.
> 
> Every line of code, database query, API route, background job, and third-party vendor connection MUST adhere strictly to the rules below.

---

## 1. General Principles & Core Architecture

1. **Healthcare EMR Standards**: Treat the system as a real-world Medical Aesthetic EMR (Electronic Medical Record) & Practice Management System.
2. **Fresh Backend Architecture**:
   - Backend framework: Node.js + Express + TypeScript.
   - Database ORM: **Prisma ORM** (Single source of database schema truth).
   - Target Database: **PostgreSQL 16** (AWS RDS).
   - Cache & Queue: **Redis + BullMQ**.
   - Storage: **AWS S3** (Presigned URLs only, no public URLs).
3. **Zero-Trust PHI Security**: Protected Health Information (PHI) is sensitive legal data. Never expose PHI without authentication, authorization, input validation, and audit logging.

---

## 2. Backend & Controller Rules

1. **Architecture Hierarchy**:
   ```
   Express Controller  -->  Service Layer  -->  Prisma ORM  -->  PostgreSQL
   ```
   - Controllers handle HTTP request/response parsing and status codes ONLY.
   - Controllers MUST call the Service Layer. Direct database queries from controllers are strictly forbidden.
   - Services contain ALL business logic and Prisma calls.
2. **Explicit Controllers Only**: Generic `/api/:tableName` endpoints are prohibited. Every resource must have an explicit, dedicated controller.
3. **BAA Enforcement**: NEVER send PHI or PHI-adjacent data (client name + appointment time/service) to a vendor without a verified Business Associate Agreement (BAA).
   - **VO Alerts**: Route through **Resend / AWS SES** (BAA covered). **STRICTLY DO NOT ROUTE PHI THROUGH BREVO** (Brevo is for non-PHI marketing only).
   - **SMS Reminders**: Route through GoHighLevel / Twilio with minimal PHI in message bodies.
4. **Input Validation**: Validate every incoming API request using Zod schemas before executing business logic.

---

## 3. Database & Clinical Rules

1. **Single Source of Truth**: `prisma/schema.prisma` is the sole authoritative definition of the database schema.
2. **Soft Delete Mandate**: Clinical records, patient profiles, consent forms, SOAP notes, and audit logs **CANNOT BE HARD DELETED**.
   - Use status fields (`isActive: false`, `status: 'cancelled'`).
   - Retain clinical records for at least 7 years per California Medical Board rules (CA §1300.68).
3. **SOAP Note Immutability**:
   - SOAP notes in `signed` or `locked` state can NEVER be modified or deleted.
   - RN / Injector notes MUST route through the Cosign Queue for approval by Dr. Fobi, MD or Kiem, NP.
   - Patient-requested chart corrections MUST be logged as separate addendums (`NoteAddendum`), preserving original note immutability.
4. **AI Scribe Audio Purge**:
   - Raw audio recordings stored in S3 (`ScribeSession`) MUST be automatically purged after 30 days via background workers.
   - Retain final transcript and generated SOAP note.
5. **Financial Integrity**: Store all monetary values in **cents as integers** (`priceCents`, `amountCents`). Never use floating-point numbers for currency.

---

## 4. Security & Audit Rules

1. **PHI Access Audit Trail**: Every access, view, creation, modification, export, or deletion attempt of PHI MUST trigger an entry in `AuditLog` and `PhiAccessLog`.
2. **Multi-Factor Authentication (MFA)**: MFA is required for all privileged roles (`admin`, `medical_director`, `nurse_practitioner`, `staff`, `privacy_officer`) with a 14-day grace period.
3. **Idle Session Auto-Logout**: Enforce 15-minute idle session timeout with a 60-second warning modal (`useIdleLogout`).
4. **California CMIA Breach Notification**: Track the **15-business-day breach notification deadline** (`cmiaDeadline`) for patient and CA Attorney General notifications.
5. **External Disclosures**: Track all non-treatment PHI sharing in `ExternalDisclosure` with a 6-year retention period.

---

## 5. Coding & Execution Checklist

Before declaring any backend task or feature complete:
- [ ] TypeScript compiles cleanly with 0 build or lint errors.
- [ ] Prisma schema syntax validated and migration generated cleanly.
- [ ] Backend route enforces Authentication (JWT), Authorization (RBAC), and Zod Request Validation.
- [ ] PHI access routes execute audit logging (`AuditLog` / `PhiAccessLog`).
- [ ] No PHI is written to server logs or error stack traces.
- [ ] Transactional emails & VO alerts route exclusively through BAA-covered Resend/SES.
- [ ] Empirical runtime verification succeeded.

---

*This document serves as the mandatory ruleset for developers and AI assistants building the Radiantilyk Aesthetic platform.*
