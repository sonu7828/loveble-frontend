// Identifies which services are televisits (virtual visits).
// All Medical Wellness services (GLP-1, HRT, Peptides) are televisit-only,
// with Kiem, at both locations.

export const TELEVISIT_SERVICE_IDS = new Set<string>([
  "5d000000-0000-0000-0000-000000000004", // Televisit Consultation
  "5d000000-0000-0000-0000-000000000005", // Televisit Follow-Up
  "a1000000-0000-0000-0000-000000000003", // Peptide Therapy
  "a1000000-0000-0000-0000-000000000002", // GLP- Wellness management
  "5d000000-0000-0000-0000-000000000001", // GLP-1 / HRT / Peptides
]);

export function hasTelevisit(serviceIds: Array<string | null | undefined>): boolean {
  return serviceIds.some((id) => !!id && TELEVISIT_SERVICE_IDS.has(id));
}

export const TELEVISIT_LABEL = "Televisit (Virtual visit)";

export function televisitLocationName(baseLocationName?: string | null): string {
  if (!baseLocationName) return TELEVISIT_LABEL;
  return `${TELEVISIT_LABEL} — ${baseLocationName}`;
}

export const TELEVISIT_ARRIVAL_INSTRUCTIONS =
  "This is a TELEVISIT (virtual visit) — no in-person check-in required.\n" +
  "Kiem will call or text you at your appointment time. Please be available by phone " +
  "and in a private, well-lit space. Have your ID, current medications, and any recent " +
  "lab results ready. If you do not hear from us within 5 minutes of your scheduled time, " +
  "call/text 408-351-1873.";

export const TELEVISIT_ADDRESS_LINE = "Televisit — appointment will be conducted by phone/video";
