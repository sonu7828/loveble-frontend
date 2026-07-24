import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date-only string (YYYY-MM-DD) as a LOCAL date.
 * Using `new Date("YYYY-MM-DD")` parses as UTC midnight, which renders as the
 * previous day in any timezone west of UTC (e.g. 1993-02-25 → "Feb 24" in PST).
 * Always use this for DOB / date-only columns.
 */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
