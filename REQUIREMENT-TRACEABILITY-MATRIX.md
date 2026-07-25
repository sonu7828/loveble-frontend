# Requirement Traceability Matrix (RTM)

## Radiantilyk Aesthetic — End-to-End System Traceability Matrix

**Version**: 1.0  
**Last Updated**: July 24, 2026  
**Practice**: Radiantilyk Aesthetic (San Jose, CA)  
**Privacy & Security Officer**: Kiem Vukadinovic, NP & Founder  
**Medical Director**: Dr. Aloysius N. Fobi, MD  
**Target Standard**: Designed for HIPAA-aligned & California CMIA-aligned implementation  
**Reference**: [PRD.md](./PRD.md) | [DB-SCHEMA.md](./DB-SCHEMA.md) | [API-SPECIFICATION.md](./API-SPECIFICATION.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Traceability Mapping Structure

Every client requirement is mapped directly through all 6 system layers:
```
Client Requirement  ──►  Database Model  ──►  API Endpoint  ──►  Frontend Module  ──►  User Role  ──►  Audit Event
```

---

## 1. Traceability Matrix Table

| Req ID | Client Requirement Description | Prisma DB Model(s) | API Endpoint | Frontend Component / Page | Authorized User Role(s) | Generated Audit Event |
|--------|--------------------------------|-------------------|--------------|---------------------------|------------------------|-----------------------|
| **REQ-01** | Staff authentication with custom JWT & MFA TOTP verification | `User`, `Session`, `RefreshToken`, `MfaConfig`, `MfaRecoveryCode` | `POST /api/auth/login`<br/>`POST /api/auth/mfa/verify` | `StaffLogin.tsx`<br/>`StaffMfa.tsx` | All Staff Roles | `LOGIN`, `MFA_VERIFIED` |
| **REQ-02** | Automatic idle session logout after 15 min inactivity | `Session`, `RefreshToken` | `POST /api/auth/logout` | `StaffLayout.tsx`<br/>(`useIdleLogout`) | All Staff Roles | `LOGOUT` |
| **REQ-03** | Role-based permission enforcement across system routes | `UserRole`, `Role`, `Permission`, `RolePermission` | `GET /api/auth/session` | `AdminOnly.tsx`<br/>`OwnerOnly.tsx` | Admin, Privacy Officer | `VIEW_ROLES`, `UPDATE_ROLE` |
| **REQ-04** | Patient registration & demographic profile creation | `PatientProfile`, `Demographics`, `CommunicationPreference` | `POST /api/patients`<br/>`PATCH /api/patients/:id/demographics` | `PatientAuth.tsx`<br/>`StaffClientDetail.tsx` | Receptionist, Scheduler, Staff, Admin | `CREATE_PATIENT`, `UPDATE_PATIENT` |
| **REQ-05** | Online multi-step appointment booking wizard | `Appointment`, `AppointmentService`, `ServiceLocation` | `POST /api/appointments` | `Book.tsx`<br/>(`Step1`-`Step5`) | Patient (Public), Staff | `CREATE_APPOINTMENT` |
| **REQ-06** | Appointment lifecycle state machine & front-desk check-in | `Appointment`, `AppointmentStatusHistory` | `PATCH /api/appointments/:id/check-in`<br/>`PATCH /api/appointments/:id/start` | `StaffToday.tsx`<br/>`StartVisitFlow.tsx` | Receptionist, Staff | `UPDATE_APPOINTMENT_STATUS` |
| **REQ-07** | Clinical SOAP chart note documentation & draft autosave | `SoapNote`, `SoapNoteVersion`, `Encounter` | `POST /api/clinical/notes`<br/>`POST /api/clinical/notes/:id/autosave` | `ChartNoteEditor.tsx` | Staff, NP, MD, Admin | `CREATE_CHART`, `UPDATE_CHART` |
| **REQ-08** | RN Injector note cosign queue & MD/NP locking workflow | `SoapNote`, `CosignQueue`, `NoteSignature` | `PATCH /api/clinical/notes/:id/cosign`<br/>`PATCH /api/clinical/notes/:id/lock` | `StaffCosignQueue.tsx` | Medical Director, NP, Admin | `COSIGN_CHART`, `LOCK_CHART` |
| **REQ-09** | Injectable treatment record with toxin/filler lot burn | `TreatmentUsage`, `InventoryLot`, `InventoryMovement` | `POST /api/clinical/notes`<br/>`POST /api/inventory/adjust` | `InjectionTreatmentRecord.tsx`<br/>`LotPicker.tsx` | Staff, NP, MD | `BURN_INVENTORY_LOT` |
| **REQ-10** | Toxin safety limit guardrails & facial area mapping | `SoapNote`, `Product` | `POST /api/clinical/notes` | `toxGuardrails.ts`<br/>`InjectionTreatmentRecord.tsx` | Staff, NP, MD | `TOXIN_SAFETY_CHECK` |
| **REQ-11** | AI Scribe voice dictation & 30-day raw audio purge | `ScribeSession`, `AudioLifecycleLog`, `TranscriptStorage`, `PurgeLog` | `POST /api/clinical/scribe/session`<br/>`DELETE /api/clinical/scribe/:id/audio` | `AIScribeDialog.tsx` | Staff, NP, MD | `PURGE_SCRIBE_AUDIO` |
| **REQ-12** | Good Faith Estimate (GFE) creation for No Surprises Act | `GfeForm`, `PatientProfile`, `StaffProfile` | `POST /api/clinical/gfe`<br/>`PATCH /api/clinical/gfe/:id/sign` | `GFEForm.tsx`<br/>`GFEIndex.tsx` | NP, MD, Admin | `CREATE_GFE`, `SIGN_GFE` |
| **REQ-13** | Digital consent form assignment & patient e-signature | `ConsentTemplate`, `ConsentAssignment`, `ConsentSignature`, `ConsentAuditHistory` | `POST /api/consents/send`<br/>`POST /api/consents/:token/sign` | `PatientConsents.tsx`<br/>`ConsentSigner.tsx` | Patient, Staff | `SIGN_CONSENT` |
| **REQ-14** | Pre-visit digital patient intake questionnaires | `PatientIntake`, `PatientProfile` | `GET /api/intake/:token`<br/>`POST /api/intake/:token` | `PatientIntake.tsx` | Patient, Staff | `SUBMIT_INTAKE` |
| **REQ-15** | Post-procedure check-ins & PROMs survey scoring | `PostOpCheckIn`, `PromResponse` | `POST /api/patient/post-op`<br/>`POST /api/patient/proms` | `PostOpCheckInsCard.tsx`<br/>`PromSurveysCard.tsx` | Patient, Staff | `SUBMIT_PROM_RESPONSE` |
| **REQ-16** | Multi-location clinic support & provider schedule sync | `Location`, `StaffLocation`, `StaffAvailability`, `StaffTimeOff` | `GET /api/locations`<br/>`GET /api/appointments/calendar` | `StaffCalendar.tsx`<br/>`StaffMySchedule.tsx` | Scheduler, Staff, Admin | `VIEW_SCHEDULE` |
| **REQ-17** | 2-Way Staff Google Calendar synchronization | `StaffGoogleOauth`, `AppointmentStaffCalendarEvent` | `POST /api/staff/google-oauth`<br/>`POST /api/staff/calendar-sync` | `GoogleCalendarConnect.tsx` | Staff, Admin | `SYNC_GOOGLE_CALENDAR` |
| **REQ-18** | Product lot inventory management & 30-day expiry alerts | `Product`, `Vendor`, `InventoryLot`, `LotExpiryTracking`, `InventoryMovement` | `GET /api/inventory/lots`<br/>`POST /api/inventory/lots` | `StaffInventory.tsx`<br/>`ReceiveLotDialog.tsx` | Staff, Admin | `RECEIVE_INVENTORY_LOT` |
| **REQ-19** | Checkout POS itemized billing & Stripe Terminal charges | `Invoice`, `InvoiceItem`, `Payment`, `PaymentMethod` | `POST /api/payments/charge`<br/>`POST /api/payments/webhook` | `StaffCheckout.tsx`<br/>`CardOnFile.tsx` | Receptionist, Staff, Admin | `PROCESS_PAYMENT` |
| **REQ-20** | Automated no-show fee charging policy enforcement | `NoShowCharge`, `Appointment`, `PaymentMethod` | `POST /api/payments/no-show-charge` | `ChargeNoShowDialog.tsx` | Receptionist, Admin | `CHARGE_NO_SHOW_FEE` |
| **REQ-21** | Patient credit balance & promo voucher processing | `PatientCredit`, `Voucher`, `Package` | `POST /api/patients/:id/credits` | `ClientRewardsCard.tsx` | Admin, Receptionist | `ISSUE_PATIENT_CREDIT` |
| **REQ-22** | Comprehensive PHI access & view audit trail logging | `AuditLog`, `PhiAccessLog` | `GET /api/audit/logs`<br/>`GET /api/audit/phi-access/:id` | `AdminAudit.tsx`<br/>`AdminAuditReport.tsx` | Privacy Officer, Admin | `VIEW_PHI_AUDIT_LOGS` |
| **REQ-23** | California CMIA 15-business-day breach incident tracking | `BreachReport`, `User` | `POST /api/breach-reports`<br/>`PATCH /api/breach-reports/:id` | `StaffBreachReport.tsx` | Privacy Officer, Admin | `REPORT_BREACH` |
| **REQ-24** | Patient chart amendment requests & attached addendums | `NoteAddendum`, `SoapNote`, `PatientProfile` | `POST /api/patients/:id/amendments` | `PatientAccount.tsx`<br/>`ChartNoteEditor.tsx` | Patient, Staff, MD | `CREATE_CHART_ADDENDUM` |
| **REQ-25** | External PHI disclosures tracking (6-year retention) | `ExternalDisclosure`, `PatientProfile`, `StaffProfile` | `POST /api/disclosures`<br/>`GET /api/disclosures/:id` | `ClientExternalDisclosuresCard.tsx` | Privacy Officer, Admin | `LOG_EXTERNAL_DISCLOSURE` |
| **REQ-26** | Patient PHI deletion request evaluation vs 7-yr retention | `PhiDeletionRequest`, `PatientProfile` | `POST /api/patients/:id/deletion-request` | `PatientAccount.tsx` | Patient, Privacy Officer | `REQUEST_PHI_DELETION` |
| **REQ-27** | Encrypted S3 clinical photos & document upload / download | `PatientDocument`, `PatientPhoto` | `POST /api/files/upload`<br/>`GET /api/files/:key` | `PhotoCaptureFlow.tsx`<br/>`ClientIdDocuments.tsx` | Staff, NP, MD, Patient | `UPLOAD_PHOTO`, `VIEW_PHOTO` |
| **REQ-28** | Vendor BAA document tracking & compliance verification | `Vendor`, `VendorBaa` | `GET /api/vendors`<br/>`POST /api/vendors` | `AdminVendors.tsx` | Admin, Privacy Officer | `UPDATE_VENDOR_BAA` |
| **REQ-29** | HIPAA policy document versioning & staff training signatures | `PolicyVersion`, `StaffTrainingRecord` | `GET /api/hipaa-policies`<br/>`POST /api/compliance/acknowledge` | `AdminHipaaPolicies.tsx`<br/>`MyCompliance.tsx` | Staff, Privacy Officer, Admin | `ACKNOWLEDGE_POLICY` |
| **REQ-30** | Clinic device inventory management & encryption logging | `DeviceInventory`, `StaffProfile` | `GET /api/admin/pos-config`<br/>`PATCH /api/admin/pos-config` | `AdminPosConfig.tsx` | Admin, Privacy Officer | `UPDATE_DEVICE_INVENTORY` |

---

*This Requirement Traceability Matrix ensures 100% end-to-end alignment from client requirements to database models, API routes, UI components, roles, and audit events.*
