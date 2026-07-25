# Database Schema Document

## Radiantilyk Aesthetic — Production Database & Prisma ORM Specification

**Version**: 3.0 (Fresh Architecture — Prisma ORM Single Source of Truth)  
**Last Updated**: July 24, 2026  
**Target Engine**: PostgreSQL 16 (AWS RDS PostgreSQL)  
**ORM Framework**: Prisma ORM (`backend/prisma/schema.prisma`)  
**Target Standard**: Designed for HIPAA-aligned & California CMIA-aligned implementation  
**Reference**: [PRD.md](./PRD.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. Schema Design Principles & Conventions

- **Single Source of Truth**: `backend/prisma/schema.prisma` is the sole authoritative schema definition.
- **Primary Keys**: UUID v4 mapped to `@default(uuid()) @db.Uuid`.
- **Timestamps**: All timestamps use `@db.Timestamptz` (timezone-aware).
- **Soft Delete**: Clinical records, patient profiles, and logs use `isActive: false` or status flags — **NEVER HARD DELETED**.
- **Currency**: All monetary amounts are stored in cents as `Int` (e.g., `$350.00` = `35000`).
- **Data Types**: PostgreSQL native types (`Uuid`, `VarChar`, `Text`, `Date`, `Timestamptz`, `Json`, `Decimal`, `Int`, `Boolean`).
- **Cascade & Restrict Rules**:
  - `ON DELETE RESTRICT` on all PHI resources (Patients, Notes, Encounters, Invoices) to prevent orphaned data.
  - `ON DELETE CASCADE` for child/dependent records (RolePermissions, Itemized line items, Session tokens).
- **Indexes**: Explicit `@index` directives on all foreign keys, status fields, and audit timestamp queries.

---

## 2. Module Overview & Model Count

The database is divided into 12 core functional modules containing **62 Prisma models**:

```
                               ┌───────────────────────────┐
                               │     12 Core Modules       │
                               │        (62 Models)        │
                               └─────────────┬─────────────┘
                                             │
      ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
      │                  │                   │                   │                  │
┌─────▼──────┐    ┌──────▼─────┐     ┌───────▼──────┐    ┌───────▼──────┐   ┌───────▼──────┐
│  Auth &    │    │  Patients  │     │ Services &   │    │ Clinical EMR │   │  AI Scribe   │
│  Identity  │    │   & PHI    │     │ Appointments │    │  & Cosign    │   │  & Audio     │
│ (9 Models) │    │ (10 Models)│     │  (9 Models)  │    │ (11 Models)  │   │  (4 Models)  │
└────────────┘    └────────────┘     └──────────────┘    └──────────────┘   └──────────────┘
      │                  │                   │                   │                  │
┌─────▼──────┐    ┌──────▼─────┐     ┌───────▼──────┐    ┌───────▼──────┐   ┌───────▼──────┐
│ Consents   │    │ Inventory  │     │ Payments     │    │ Compliance   │   │ Comm & Logs  │
│ (5 Models) │    │ & Vendors  │     │ & Billing    │    │  & Audit     │   │  (4 Models)  │
└────────────┘    │ (7 Models) │     │ (9 Models)   │    │ (7 Models)   │   └──────────────┘
                  └────────────┘     └──────────────┘    └──────────────┘
```

---

## 3. Detailed Model Definitions by Module

### 3.1 Module 1: Authentication & Identity (9 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `User` | `users` | Primary user login account | StaffProfile, PatientProfile, UserRoles, AuditLogs |
| `Role` | `roles` | Role definitions (`admin`, `medical_director`, etc.) | RolePermissions, UserRoles |
| `Permission` | `permissions` | Granular action codes (`patient:read`, `chart:write`) | RolePermissions |
| `RolePermission` | `role_permissions` | Junction mapping roles to permissions | Role, Permission |
| `UserRole` | `user_roles` | Junction mapping users to assigned roles | User, Role |
| `Session` | `sessions` | Active JWT user session metadata | User |
| `RefreshToken` | `refresh_tokens` | JWT refresh tokens with revocation flag | User |
| `MfaConfig` | `mfa_configs` | TOTP secret & MFA verification status | User |
| `MfaRecoveryCode` | `mfa_recovery_codes` | Hashed backup recovery codes | User |

```prisma
model User {
  id                   String        @id @default(uuid()) @db.Uuid
  email                String        @unique @db.VarChar(255)
  passwordHash         String        @map("password_hash") @db.VarChar(255)
  isActive             Boolean       @default(true) @map("is_active")
  mfaEnabled           Boolean       @default(false) @map("mfa_enabled")
  mfaSecret            String?       @map("mfa_secret") @db.VarChar(255)
  mfaGracePeriodEndsAt DateTime?     @map("mfa_grace_period_ends_at") @db.Timestamptz
  lastLoginAt          DateTime?     @map("last_login_at") @db.Timestamptz
  lastLoginIp          String?       @map("last_login_ip") @db.VarChar(45)
  failedAttempts       Int           @default(0) @map("failed_attempts")
  lockedUntil          DateTime?     @map("locked_until") @db.Timestamptz
  createdAt            DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime      @updatedAt @map("updated_at") @db.Timestamptz
}
```

---

### 3.2 Module 2: Staff & Practice Locations (4 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `StaffProfile` | `staff_profiles` | Clinical & practice staff details, license, NPI | User, StaffLocations, AuthoredNotes, CosignedNotes |
| `Location` | `locations` | Clinic locations (San Jose, etc.) | StaffLocations, ServiceLocations, Appointments |
| `StaffLocation` | `staff_locations` | Many-to-many staff & location mapping | StaffProfile, Location |
| `DeviceInventory` | `device_inventories` | Managed iPads, laptops, terminals | StaffProfile |

---

### 3.3 Module 3: Patients & PHI (10 Models)

> ⚠️ All models in this module store Protected Health Information (PHI). Every read/write MUST be logged in `AuditLog` / `PhiAccessLog`.

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `PatientProfile` | `patient_profiles` | Primary patient demographic record | User, Demographics, Encounters, SoapNotes, Invoices |
| `Demographics` | `demographics` | Address, emergency contact, Fitzpatrick, insurance | PatientProfile |
| `MedicalHistory` | `medical_histories` | Active/resolved medical conditions | PatientProfile |
| `Allergy` | `allergies` | Allergens, reactions, severity | PatientProfile |
| `Medication` | `medications` | Active medications & dosages | PatientProfile |
| `PatientDocument` | `patient_documents` | S3 document metadata (ID cards, insurance) | PatientProfile, User (uploader) |
| `PatientPhoto` | `patient_photos` | Before/after clinical photo S3 keys | PatientProfile, Encounter, User |
| `CommunicationPreference` | `communication_preferences` | Email/SMS/Marketing opt-in timestamps | PatientProfile |
| `PatientIntake` | `patient_intakes` | Digital intake responses & access tokens | PatientProfile |
| `PhiDeletionRequest` | `phi_deletion_requests` | Privacy deletion requests vs 7-year retention | PatientProfile, User |

---

### 3.4 Module 4: Services & Appointments (9 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `ServiceCategory` | `service_categories` | Display categories (Injectables, Laser, etc.) | Service |
| `Service` | `services` | Service catalog (duration, price, consult flag) | ServiceCategory, Appointments, Invoices |
| `ServiceLocation` | `service_locations` | Junction for location-specific services | Service, Location |
| `ProviderService` | `provider_services` | Junction for staff service capabilities | StaffProfile, Service |
| `Appointment` | `appointments` | Bookings (`pending`, `confirmed`, `in_progress`, etc.) | PatientProfile, StaffProfile, Location, Encounters |
| `AppointmentStatusHistory` | `appointment_status_histories` | Status transition log with timestamps & author | Appointment |
| `AppointmentService` | `appointment_services` | Services included in an appointment | Appointment, Service |
| `StaffAvailability` | `staff_availabilities` | Staff working hours per location & day | Location |
| `StaffTimeOff` | `staff_time_offs` | Vacation, sick leave, PTO requests | StaffProfile |

---

### 3.5 Module 5: Clinical EMR & Cosign Workflow (11 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `Encounter` | `encounters` | Visit encounter (`initial`, `follow_up`, `procedure`) | PatientProfile, Appointment, StaffProfile |
| `SoapNote` | `soap_notes` | SOAP chart note (`draft`, `pending_cosign`, `signed`, `locked`) | PatientProfile, Encounter, StaffProfile (author/cosigner) |
| `SoapNoteVersion` | `soap_note_versions` | Version history for edits made during draft state | SoapNote |
| `NoteSignature` | `note_signatures` | Digital signatures attached to chart notes | SoapNote |
| `CosignQueue` | `cosign_queues` | RN Injector notes pending NP/MD approval | SoapNote, StaffProfile (author/cosigner) |
| `NoteAddendum` | `note_addendums` | Patient-requested chart corrections attached to note | SoapNote, PatientProfile, StaffProfile |
| `GfeForm` | `gfe_forms` | Good Faith Estimate (No Surprises Act) | PatientProfile, StaffProfile |
| `TreatmentPlan` | `treatment_plans` | Multi-session treatment plans & schedules | PatientProfile, StaffProfile |
| `Protocol` | `protocols` | Clinical & safety protocol templates (VO emergency) | ProtocolRun |
| `ProtocolRun` | `protocol_runs` | Executed protocol step completions | Protocol, PatientProfile, StaffProfile |
| `AdverseEvent` | `adverse_events` | Adverse event reports (severity, actions, outcome) | PatientProfile, Encounter, StaffProfile |

---

### 3.6 Module 6: AI Scribe & Audio Lifecycle (4 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `ScribeSession` | `scribe_sessions` | AI Scribe recording session & S3 audio key | PatientProfile, Encounter, StaffProfile |
| `AudioLifecycleLog` | `audio_lifecycle_logs` | Audit trail of audio upload, processing, purge | ScribeSession |
| `TranscriptStorage` | `transcript_storages` | Processed transcript text & confidence score | ScribeSession |
| `PurgeLog` | `purge_logs` | Audit record of S3 audio purges (30-day rule) | Resource reference |

---

### 3.7 Module 7: Consent Management (5 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `ConsentTemplate` | `consent_templates` | Consent form templates (versioned HTML) | Service, ConsentVersion, ConsentAssignment |
| `ConsentVersion` | `consent_versions` | Version history of consent template text | ConsentTemplate |
| `ConsentAssignment` | `consent_assignments` | Consent forms assigned to patient for appointment | PatientProfile, ConsentTemplate, Appointment |
| `ConsentSignature` | `consent_signatures` | Signed consent record with base64 signature & IP | ConsentAssignment, PatientProfile |
| `ConsentAuditHistory` | `consent_audit_histories` | Immutable history of assigned, viewed, signed events | ConsentSignature |

---

### 3.8 Module 8: Inventory & Vendors (7 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `Product` | `products` | Master product catalog (Toxins, Fillers, Skincare) | InventoryLot, InvoiceItem |
| `Vendor` | `vendors` | Product vendors & suppliers | InventoryLot, VendorBaa |
| `VendorBaa` | `vendor_baas` | Business Associate Agreement documents & verification | Vendor |
| `InventoryLot` | `inventory_lots` | Received product lots with expiry date & lot number | Product, Vendor, Location, StaffProfile |
| `LotExpiryTracking` | `lot_expiry_trackings` | Automated 30-day lot expiry alert queue | InventoryLot |
| `InventoryMovement` | `inventory_movements` | Stock adjustments (used, received, expired, transferred) | InventoryLot, StaffProfile |
| `TreatmentUsage` | `treatment_usages` | Product units burned during patient encounter | Encounter, InventoryLot, StaffProfile |

---

### 3.9 Module 9: Payments & Invoices (9 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `Invoice` | `invoices` | Patient invoice (`unpaid`, `paid`, `void`) | PatientProfile, Appointment, InvoiceItem, Payment |
| `InvoiceItem` | `invoice_items` | Line items (services or products) | Invoice, Service, Product |
| `Payment` | `payments` | Stripe charges, cash, financing payments | Invoice, PatientProfile, Appointment, StaffProfile |
| `Refund` | `refunds` | Processed Stripe or cash refunds | Payment |
| `Voucher` | `vouchers` | Promo codes & discount vouchers | Usage tracking |
| `Package` | `packages` | Pre-purchased service bundles | Service list |
| `PatientCredit` | `patient_credits` | Patient credit balance (refunds, promos) | PatientProfile, Payment, StaffProfile |
| `PaymentMethod` | `payment_methods` | Stored Stripe payment method tokens (last4, brand) | PatientProfile, NoShowCharge |
| `NoShowCharge` | `no_show_charges` | Auto-captured no-show fee records | Appointment, PatientProfile, PaymentMethod |

---

### 3.10 Module 10: Compliance, Audit & Governance (7 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `AuditLog` | `audit_logs` | System audit trail (actions, resources, metadata) | User |
| `PhiAccessLog` | `phi_access_logs` | Dedicated PHI access log (VIEW_CHART, DOWNLOAD_PDF) | User, PatientProfile |
| `BreachReport` | `breach_reports` | Incident reports with CMIA 15-business-day countdown | User (reporter) |
| `PolicyVersion` | `policy_versions` | HIPAA/CMIA policy documents & versioning | User, StaffTrainingRecord |
| `StaffTrainingRecord` | `staff_training_records` | Staff policy acknowledgment signatures & IP | StaffProfile, PolicyVersion |
| `DeviceInventory` | `device_inventories` | Managed iPads, laptops, screen-lock & encryption state | StaffProfile |
| `ExternalDisclosure` | `external_disclosures` | Accounting of external PHI disclosures (6-yr retention) | PatientProfile, StaffProfile |

---

### 3.11 Module 11: Communication & Logs (4 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `EmailLog` | `email_logs` | Transactional email delivery logs (Resend/SES) | Recipient, PatientProfile |
| `SmsLog` | `sms_logs` | SMS delivery logs (GHL/Twilio) | Recipient, PatientProfile |
| `NotificationQueue` | `notification_queues` | Outbound email/SMS BullMQ job queue | System |
| `WebhookLog` | `webhook_logs` | Inbound Stripe webhook logs (Idempotency) | Event ID |

---

### 3.12 Module 12: PROMs & Terminal Configuration (4 Models)

| Model Name | Table Name | Purpose | Key Relations |
|------------|------------|---------|---------------|
| `PostOpCheckIn` | `postop_checkins` | Post-op surveys (Day 1, 3, 7, 14 pain & swelling) | PatientProfile, Encounter |
| `PromResponse` | `prom_responses` | Patient-Reported Outcome Measures (FACE-Q, GAIS) | PatientProfile |
| `TerminalSettings` | `terminal_settings` | Stripe Terminal reader config per location | Location |
| `Reward` | `rewards` | Patient loyalty points & tiers | PatientProfile |

---

## 4. Prisma Validation & Migration Strategy

1. **Schema File Location**: `backend/prisma/schema.prisma`.
2. **Environment Configuration**: Set `DATABASE_URL` in `backend/.env`.
3. **Migration Command**:
   ```bash
   npx prisma migrate dev --name init_emr_schema
   ```
4. **Prisma Client Generation**:
   ```bash
   npx prisma generate
   ```

---

*This DB-SCHEMA v3.0 specifies the complete 62-model database schema for Radiantilyk Aesthetic using Prisma ORM.*
