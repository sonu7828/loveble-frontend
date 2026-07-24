// Single source of truth for the public-facing cancellation policy copy.
// Update here and every surface (Services page, Booking flow, Booking status,
// Specials, calendar invites, etc.) stays in sync.
export const CANCELLATION_NOTICE_HOURS = 48;
export const CANCELLATION_FEE_USD = 200;
export const CLINIC_PHONE_DISPLAY = "408-351-1873";
export const CLINIC_PHONE_TEL = "tel:4083511873";

/** Long-form blurb for marketing surfaces (Services, Specials). */
export const CANCELLATION_POLICY_LONG =
  `${CANCELLATION_NOTICE_HOURS} hours notice required. A $${CANCELLATION_FEE_USD} fee applies for no-shows or cancellations inside the ${CANCELLATION_NOTICE_HOURS}-hour window, charged to the card on file.`;

/** One-liner for compact surfaces (booking step hint, calendar invite details). */
export const CANCELLATION_POLICY_SHORT =
  `Free changes up to ${CANCELLATION_NOTICE_HOURS} hours before your appointment. After that a $${CANCELLATION_FEE_USD} fee may apply.`;

/** Warning shown when a user tries to change/cancel inside the window. */
export const WITHIN_WINDOW_WARNING =
  `This is within ${CANCELLATION_NOTICE_HOURS} hours of your appointment. Per our policy, a $${CANCELLATION_FEE_USD} no-show fee may be charged to your card on file.`;

/** Plain-text variant used in calendar invite "details" field. */
export const CANCELLATION_POLICY_INVITE =
  `Cancellation policy: ${CANCELLATION_NOTICE_HOURS} hours notice required; $${CANCELLATION_FEE_USD} fee for no-shows or late cancellations.`;
