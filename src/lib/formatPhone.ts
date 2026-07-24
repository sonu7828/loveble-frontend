/**
 * Formats a phone string up to a maximum of 10 numeric digits: (XXX) XXX-XXXX
 */
export function formatPhone10(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Returns raw numeric digits, capped at max 10.
 */
export function getPhoneDigits10(val: string): string {
  return val.replace(/\D/g, "").slice(0, 10);
}
