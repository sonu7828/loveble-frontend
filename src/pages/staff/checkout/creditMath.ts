import { LineItem } from "./shared";

export type ServiceCredit = {
  id: string;
  kind: string;
  service_id: string | null;
  service_label: string | null;
  units: number | null;
  amount_cents: number;
  reason: string;
};

/** Dollar value a single service credit can knock off, given current line items. */
export function computeServiceCreditDiscount(cred: ServiceCredit, items: LineItem[]): number {
  // Unit-bank credit (service_value with `units` + service_id): partial redemption
  // against a matching unit_service line. Only the dollars actually used are
  // deducted; the remainder stays on the bank for next visit.
  if (cred.kind === "service_value" && cred.units && cred.units > 0 && cred.service_id) {
    // Match either a true unit_service line OR a plain service line for the
    // same service (some appointments pre-populate Neurotoxins as a "service"
    // line with quantity = units rather than a unit_service line).
    const line = items.find(
      it => (it.kind === "unit_service" || it.kind === "service") && it.reference_id === cred.service_id && it.quantity > 0,
    );
    if (!line) return 0;
    const pricePerUnit = cred.amount_cents / cred.units;
    const usedCents = Math.round(Math.min(line.quantity, cred.units) * pricePerUnit);
    return Math.max(0, Math.min(usedCents, cred.amount_cents, line.line_total_cents));
  }
  if (cred.kind === "service_value") return Math.max(0, cred.amount_cents);
  if (cred.service_id) {
    const line = items.find(it => it.kind === "service" && it.reference_id === cred.service_id);
    if (line) return Math.min(line.line_total_cents, cred.amount_cents);
  }
  return Math.max(0, cred.amount_cents);
}

/** True when this credit is a unit-bank entry that auto-applies partial dollars. */
export function isUnitBankCredit(cred: ServiceCredit): boolean {
  return cred.kind === "service_value" && !!cred.units && cred.units > 0 && !!cred.service_id;
}

/** Total cents from all currently-claimed service credits. */
export function sumClaimedServiceCredits(
  serviceCredits: ServiceCredit[],
  claimedCreditIds: string[],
  items: LineItem[],
): number {
  return serviceCredits
    .filter(c => claimedCreditIds.includes(c.id))
    .reduce((sum, c) => sum + computeServiceCreditDiscount(c, items), 0);
}

/** Clamps the account-credit dollar input against balance and remaining due. */
export function clampCreditApply(
  creditApplyDollars: string,
  creditBalanceCents: number,
  amountDueCents: number,
  claimedServiceCreditCents: number,
): number {
  return Math.max(
    0,
    Math.min(
      creditBalanceCents,
      Math.round((parseFloat(creditApplyDollars) || 0) * 100),
      Math.max(0, amountDueCents - claimedServiceCreditCents),
    ),
  );
}
