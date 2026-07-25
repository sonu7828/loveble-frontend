# API Specification Document

## Radiantilyk Aesthetic — Complete REST API Reference (OpenAPI 3.1 Structural Specification)

**Version**: 3.0 (Fresh Architecture — Node.js + Express + Prisma ORM + PostgreSQL 16)  
**Last Updated**: July 24, 2026  
**Base URL**: `http://localhost:5000/api`  
**OpenAPI Specification**: 3.1.0  
**Target Standard**: Designed for HIPAA-aligned & California CMIA-aligned implementation  
**Reference**: [PRD.md](./PRD.md) | [ARCHITECTURE.md](./ARCHITECTURE.md) | [DB-SCHEMA.md](./DB-SCHEMA.md)

---

## Standard Endpoint Contract

Every endpoint in this specification adheres strictly to the contract below:

```json
// Success Response (HTTP 200/201)
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasMore": true
  }
}

// Error Response (HTTP 4xx/5xx)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [
      { "field": "email", "message": "Invalid email address format" }
    ]
  }
}
```

---

## 1. Authentication Module (`/api/auth`)

### 1.1 POST `/api/auth/login`
- **Purpose**: Authenticate user credentials, check MFA requirements, generate JWT tokens.
- **Authentication**: None (Public)
- **Required Role**: None
- **Request Body**:
  ```json
  {
    "email": "user@radiantilyk.com",
    "password": "SecurePassword123!"
  }
  ```
- **Validation Rules**: `email` must be valid format, `password` min 8 chars.
- **Response Format (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "user": {
        "id": "uuid",
        "email": "user@radiantilyk.com",
        "roles": ["staff", "nurse_practitioner"],
        "mfaRequired": false
      }
    }
  }
  ```
- **Audit Event Generated**: `LOGIN` (or `LOGIN_FAILED` on 401)
- **Error Responses**: 400 Validation Error, 401 Invalid Credentials, 423 Account Locked (5 failed attempts).

---

### 1.2 POST `/api/auth/logout`
- **Purpose**: Invalidate refresh token and destroy session in Redis.
- **Authentication**: Bearer JWT Access Token
- **Required Role**: Any Authenticated User
- **Request Body**: None
- **Response Format (200 OK)**: `{ "success": true, "data": { "message": "Logged out successfully" } }`
- **Audit Event Generated**: `LOGOUT`
- **Error Responses**: 401 Unauthorized.

---

### 1.3 POST `/api/auth/refresh`
- **Purpose**: Issue new access token using a valid refresh token.
- **Authentication**: None (Refresh Token in body)
- **Required Role**: None
- **Request Body**: `{ "refreshToken": "jwt-refresh-token" }`
- **Validation Rules**: `refreshToken` required string.
- **Response Format (200 OK)**: `{ "success": true, "data": { "accessToken": "new-jwt-access-token" } }`
- **Audit Event Generated**: None
- **Error Responses**: 401 Refresh Token Expired / Revoked.

---

### 1.4 POST `/api/auth/mfa/verify`
- **Purpose**: Verify TOTP 6-digit code for MFA login.
- **Authentication**: Bearer JWT Access Token (AAL1)
- **Required Role**: Any Privileged Role
- **Request Body**: `{ "code": "123456" }`
- **Validation Rules**: `code` exactly 6 numeric digits.
- **Response Format (200 OK)**: Upgrades session to AAL2, returns upgraded tokens.
- **Audit Event Generated**: `MFA_VERIFIED`
- **Error Responses**: 400 Invalid Code, 401 Token Expired.

---

## 2. Patients & PHI Module (`/api/patients`)

### 2.1 GET `/api/patients`
- **Purpose**: Search & list patient profiles with cursor/page pagination.
- **Authentication**: Bearer JWT Access Token
- **Required Role**: `admin`, `medical_director`, `nurse_practitioner`, `staff`, `scheduler`, `receptionist`
- **Request Body**: None (Query params: `search`, `page`, `limit`)
- **Validation Rules**: `page` >= 1, `limit` <= 100.
- **Response Format (200 OK)**: Array of patient summary objects.
- **Audit Event Generated**: None (List view)
- **Error Responses**: 401 Unauthorized, 403 Forbidden.

---

### 2.2 GET `/api/patients/:id`
- **Purpose**: Retrieve complete patient profile including demographics, medical history, allergies, medications.
- **Authentication**: Bearer JWT Access Token
- **Required Role**: `admin`, `medical_director`, `nurse_practitioner`, `staff`, `scheduler`, `receptionist`
- **Request Body**: None
- **Validation Rules**: `:id` valid UUID.
- **Response Format (200 OK)**: PatientProfile object with relations.
- **Audit Event Generated**: `VIEW_PATIENT` (Recorded in `PhiAccessLog`)
- **Error Responses**: 401 Unauthorized, 403 Forbidden, 404 Patient Not Found.

---

### 2.3 POST `/api/patients`
- **Purpose**: Create a new patient profile & demographics.
- **Authentication**: Bearer JWT Access Token
- **Required Role**: `admin`, `medical_director`, `nurse_practitioner`, `staff`, `scheduler`, `receptionist`
- **Request Body**:
  ```json
  {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane.doe@example.com",
    "phone": "+14085551234",
    "dateOfBirth": "1988-04-12",
    "gender": "female"
  }
  ```
- **Validation Rules**: `firstName`, `lastName`, `email` required.
- **Response Format (201 Created)**: Created PatientProfile object.
- **Audit Event Generated**: `CREATE_PATIENT`
- **Error Responses**: 400 Validation Error, 409 Email Already Exists.

---

### 2.4 POST `/api/patients/:id/amendments`
- **Purpose**: Log a patient-requested chart amendment (CMIA/HIPAA compliance).
- **Authentication**: Bearer JWT Access Token
- **Required Role**: Patient or Clinical Staff
- **Request Body**:
  ```json
  {
    "noteId": "uuid-note-id",
    "reason": "Requested correction to allergy description",
    "addendumText": "Patient clarifies allergy reaction is mild hives, not anaphylaxis."
  }
  ```
- **Validation Rules**: `noteId`, `reason`, `addendumText` required strings.
- **Response Format (201 Created)**: Created `NoteAddendum` object.
- **Audit Event Generated**: `CREATE_CHART_ADDENDUM`
- **Error Responses**: 404 Note Not Found, 400 Validation Error.

---

### 2.5 POST `/api/patients/:id/deletion-request`
- **Purpose**: File a PHI deletion request (Evaluated against CA §1300.68 7-year retention rules).
- **Authentication**: Bearer JWT Access Token
- **Required Role**: Patient or Privacy Officer
- **Request Body**: `{ "reason": "Patient requested record erasure" }`
- **Response Format (201 Created)**: Created `PhiDeletionRequest` object (Status: `pending`).
- **Audit Event Generated**: `PHI_DELETION_REQUESTED`
- **Error Responses**: 404 Patient Not Found.

---

## 3. Appointment Module (`/api/appointments`)

### 3.1 GET `/api/appointments`
- **Purpose**: Query appointments with filters (date range, provider, location, status).
- **Authentication**: Bearer JWT Access Token
- **Required Role**: `admin`, `medical_director`, `nurse_practitioner`, `staff`, `scheduler`, `receptionist`
- **Request Body**: None (Query params: `startAt`, `endAt`, `staffId`, `locationId`, `status`)
- **Response Format (200 OK)**: Array of Appointment objects.
- **Audit Event Generated**: None

---

### 3.2 POST `/api/appointments`
- **Purpose**: Create a new appointment booking.
- **Authentication**: Bearer JWT Access Token or Booking Token
- **Required Role**: Any Staff or Public Patient
- **Request Body**:
  ```json
  {
    "patientId": "uuid-patient-id",
    "staffId": "uuid-staff-id",
    "locationId": "uuid-location-id",
    "serviceIds": ["uuid-service-1"],
    "startAt": "2026-07-28T10:00:00Z",
    "notes": "First time consultation"
  }
  ```
- **Validation Rules**: `patientId`, `staffId`, `locationId`, `serviceIds`, `startAt` required.
- **Response Format (201 Created)**: Created Appointment object (Status: `pending` or `confirmed`).
- **Audit Event Generated**: `CREATE_APPOINTMENT`
- **Error Responses**: 400 Validation Error, 409 Provider Time Slot Conflict.

---

### 3.3 Appointment Lifecycle Status Transitions
- **PATCH `/api/appointments/:id/approve`**: Status `pending` → `confirmed` (Role: scheduler, receptionist, admin).
- **PATCH `/api/appointments/:id/check-in`**: Status `confirmed` → `checked_in` (Role: receptionist, staff).
- **PATCH `/api/appointments/:id/start`**: Status `checked_in` → `in_progress` (Role: clinical staff).
- **PATCH `/api/appointments/:id/complete`**: Status `in_progress` → `completed` (Role: clinical staff).
- **PATCH `/api/appointments/:id/no-show`**: Status `confirmed` → `no_show` (Role: receptionist, admin).

---

## 4. Clinical EMR Module (`/api/clinical`)

### 4.1 POST `/api/clinical/notes`
- **Purpose**: Create a new SOAP chart note draft.
- **Authentication**: Bearer JWT Access Token
- **Required Role**: `admin`, `medical_director`, `nurse_practitioner`, `staff`
- **Request Body**:
  ```json
  {
    "patientId": "uuid-patient-id",
    "encounterId": "uuid-encounter-id",
    "subjective": "Patient reports fine lines on forehead.",
    "objective": "Fitzpatrick Type II. No active skin lesions.",
    "assessment": "Forehead rhytids suitable for Neurotoxin.",
    "plan": "Administered 20 units Botox to forehead."
  }
  ```
- **Validation Rules**: `patientId` required UUID.
- **Response Format (201 Created)**: Created `SoapNote` object (Status: `draft`).
- **Audit Event Generated**: `CREATE_CHART`
- **Error Responses**: 400 Validation Error, 404 Patient/Encounter Not Found.

---

### 4.2 PATCH `/api/clinical/notes/:id/sign`
- **Purpose**: Sign a chart note. If author is RN/Injector, routes to `CosignQueue` (status `pending_cosign`). If MD/NP, seals note (status `signed` → `locked`).
- **Authentication**: Bearer JWT Access Token
- **Required Role**: Note Author
- **Request Body**: `{ "signatureData": "data:image/png;base64,..." }`
- **Response Format (200 OK)**: Updated `SoapNote` object.
- **Audit Event Generated**: `SIGN_CHART`
- **Error Responses**: 403 Forbidden (Not author), 409 Note Already Locked.

---

### 4.3 POST `/api/clinical/scribe/session`
- **Purpose**: Save AI Scribe audio recording metadata to ScribeSession.
- **Authentication**: Bearer JWT Access Token
- **Required Role**: `admin`, `medical_director`, `nurse_practitioner`, `staff`
- **Request Body**: `{ "patientId": "uuid", "encounterId": "uuid", "audioFileKey": "scribe/audio-123.wav" }`
- **Response Format (201 Created)**: `ScribeSession` object.
- **Audit Event Generated**: `CREATE_SCRIBE_SESSION`

---

## 5. Compliance & Audit Module (`/api/compliance` & `/api/audit`)

### 5.1 GET `/api/audit/logs`
- **Purpose**: Query system audit logs (Admin / Privacy Officer inspection).
- **Authentication**: Bearer JWT Access Token
- **Required Role**: `admin`, `privacy_officer`
- **Request Body**: None (Query params: `userId`, `patientId`, `action`, `startDate`, `endDate`)
- **Response Format (200 OK)**: Array of `AuditLog` records.
- **Audit Event Generated**: `VIEW_AUDIT_LOGS`

---

### 5.2 POST `/api/breach-reports`
- **Purpose**: Log a security incident and initiate the CMIA 15-business-day countdown timer.
- **Authentication**: Bearer JWT Access Token
- **Required Role**: Any Authenticated Staff Member
- **Request Body**:
  ```json
  {
    "breachType": "unauthorized_access",
    "description": "Unattended unlocked laptop detected in waiting room.",
    "patientsAffected": 1,
    "phiInvolved": true,
    "discoveryDate": "2026-07-24"
  }
  ```
- **Response Format (201 Created)**: Created `BreachReport` object with computed `cmiaDeadline`.
- **Audit Event Generated**: `REPORT_BREACH`

---

### 5.3 POST `/api/disclosures`
- **Purpose**: Record an external PHI disclosure (6-year retention tracking).
- **Authentication**: Bearer JWT Access Token
- **Required Role**: `admin`, `medical_director`, `nurse_practitioner`, `privacy_officer`
- **Request Body**:
  ```json
  {
    "patientId": "uuid-patient-id",
    "disclosedTo": "Dermatology Specialist Dr. Smith",
    "purpose": "Specialist referral consultation",
    "descriptionOfPhi": "Clinical SOAP chart note dated 2026-07-20"
  }
  ```
- **Response Format (201 Created)**: Created `ExternalDisclosure` record.
- **Audit Event Generated**: `LOG_EXTERNAL_DISCLOSURE`

---

## 6. File Upload Module (`/api/files`)

### 6.1 POST `/api/files/upload`
- **Purpose**: Generate AWS S3 presigned PUT URL for direct encrypted file upload.
- **Authentication**: Bearer JWT Access Token
- **Required Role**: Any Authenticated Staff Member
- **Request Body**: `{ "fileName": "photo.jpg", "mimeType": "image/jpeg", "category": "patient_photo" }`
- **Response Format (200 OK)**: `{ "uploadUrl": "https://s3.amazonaws.com/...", "fileKey": "photos/uuid.jpg" }`
- **Audit Event Generated**: `GENERATE_UPLOAD_URL`

---

## 7. Complete API Route Summary

| Module | Endpoints | Base Route | Key Operations |
|--------|-----------|------------|----------------|
| **Auth** | 9 | `/api/auth` | Login, Logout, Refresh, Session, MFA Setup/Verify, Passwords |
| **Patients** | 15 | `/api/patients` | CRUD, Demographics, History, Allergies, Meds, Photos, Amendments, Deletion |
| **Appointments** | 12 | `/api/appointments` | CRUD, Status transitions (`approve`, `check-in`, `start`, `complete`, `no-show`) |
| **Clinical EMR** | 14 | `/api/clinical` | SOAP Notes, Cosign Queue, Addendums, GFE, Protocols, Adverse Events, AI Scribe |
| **Consents** | 6 | `/api/consents` | Templates, Assignments, Digital Signatures, Audit History |
| **Intake** | 3 | `/api/intake` | Form retrieval, Submission, Admin Dashboard |
| **Staff & Locations** | 8 | `/api/staff`, `/api/locations` | Staff profiles, Directory, 2-Way Google Sync, Location CRUD |
| **Inventory** | 7 | `/api/inventory` | Products, Lots, Adjustments, Expiry Alerts, Lot Burn |
| **Payments** | 10 | `/api/payments` | Invoices, Stripe Charges, Refunds, Credits, No-Show Fees, Stripe Webhooks |
| **Compliance & Audit** | 9 | `/api/compliance`, `/api/audit` | Audit logs, PHI Access logs, Breach reports, Disclosures, Policies |
| **Files & System** | 3 | `/api/files`, `/api/health` | S3 Presigned URLs, System Health Check |

**Total Endpoints**: **150+ explicit REST routes**

---

*This API-SPECIFICATION v3.0 defines the complete REST interface for Radiantilyk Aesthetic.*
