/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as bookingReceived } from './booking-received.tsx'
import { template as bookingApproved } from './booking-approved.tsx'
import { template as bookingDenied } from './booking-denied.tsx'
import { template as consultationApproved } from './consultation-approved.tsx'
import { template as consultationDenied } from './consultation-denied.tsx'
import { template as staffActivation } from './staff-activation.tsx'
import { template as consentReceipt } from './consent-receipt.tsx'
import { template as consentAssignment } from './consent-assignment.tsx'
import { template as consentReminder } from './consent-reminder.tsx'
import { template as clientActivation } from './client-activation.tsx'
import { template as staffBookingNotification } from './staff-booking-notification.tsx'
import { template as staffCalendarUpdate } from './staff-calendar-update.tsx'
import { template as dailyDigest } from './daily-digest.tsx'
import { template as postVisitReview } from './post-visit-review.tsx'
import { template as birthday } from './birthday.tsx'
import { template as marketingCampaign } from './marketing-campaign.tsx'
import { template as waitlistNotification } from './waitlist-notification.tsx'
import { template as bookingCancelled } from './booking-cancelled.tsx'
import { template as staffCancellationNotification } from './staff-cancellation-notification.tsx'
import { template as voucherGiftCard } from './voucher-gift-card.tsx'
import { template as postOpInstructions } from './post-op-instructions.tsx'
import { template as preOpInstructions } from './pre-op-instructions.tsx'
import { template as appointmentReminder } from './appointment-reminder.tsx'
import { template as saleReceipt } from './sale-receipt.tsx'
import { template as affirmPaymentLink } from './affirm-payment-link.tsx'
import { template as staffCardChangeNotification } from './staff-card-change-notification.tsx'
import { template as monthlyReport } from './monthly-report.tsx'
import { template as preVisitIntake } from './pre-visit-intake.tsx'
import { template as followupCheckin } from './followup-checkin.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'staff-card-change-notification': staffCardChangeNotification,
  'post-op-instructions': postOpInstructions,
  'pre-op-instructions': preOpInstructions,
  'voucher-gift-card': voucherGiftCard,
  'booking-received': bookingReceived,
  'booking-approved': bookingApproved,
  'booking-cancelled': bookingCancelled,
  'staff-cancellation-notification': staffCancellationNotification,
  'booking-denied': bookingDenied,
  'consultation-approved': consultationApproved,
  'consultation-denied': consultationDenied,
  'staff-activation': staffActivation,
  'consent-receipt': consentReceipt,
  'consent-assignment': consentAssignment,
  'consent-reminder': consentReminder,
  'client-activation': clientActivation,
  'staff-booking-notification': staffBookingNotification,
  'staff-calendar-update': staffCalendarUpdate,
  'daily-digest': dailyDigest,
  'monthly-report': monthlyReport,
  'post-visit-review': postVisitReview,
  'birthday': birthday,
  'marketing-campaign': marketingCampaign,
  'waitlist-notification': waitlistNotification,
  'appointment-reminder': appointmentReminder,
  'sale-receipt': saleReceipt,
  'affirm-payment-link': affirmPaymentLink,
  'pre-visit-intake': preVisitIntake,
  'followup-checkin': followupCheckin,
}
