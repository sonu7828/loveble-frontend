/**
 * Shared filter to exclude test/demo patients, test appointments,
 * and appointments assigned to deleted staff members (Thor, Thomas, Girish, etc.)
 */
export function isTestPatient(c: {
  client_email?: string | null;
  client_first_name?: string | null;
  client_last_name?: string | null;
  patient_email?: string | null;
  patient_first_name?: string | null;
  patient_last_name?: string | null;
  service_name?: string | null;
  staff_name?: string | null;
  staff_id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  fullName?: string | null;
}): boolean {
  if (!c) return false;

  const email = (c.client_email || c.patient_email || c.email || "").toLowerCase();
  const fn = c.client_first_name || c.patient_first_name || c.first_name || "";
  const ln = c.client_last_name || c.patient_last_name || c.last_name || "";
  const fullName = `${fn} ${ln} ${c.name || ""} ${c.fullName || ""}`.toLowerCase();
  const serviceName = (c.service_name || "").toLowerCase();
  const staffName = (c.staff_name || "").toLowerCase();
  const staffId = (c.staff_id || "").toLowerCase();

  // 1. Test patient & test service checks
  if (email.includes("@example.com") || email.includes("@radiantilyk.local") || email.includes("walkin-")) return true;
  if (email.includes("phase2a") || fullName.includes("phase2a")) return true;
  if (fullName.includes("testpatient") || fullName.includes("test patient") || fullName.includes("walk-in") || fullName.includes("walkin")) return true;
  if (fullName.includes("admin test") || fullName.includes("demo test")) return true;
  if (fullName.includes("user4") || fullName.includes("user4 resu") || fullName.includes("resu") || email === "user@gmail.com" || email.includes("user@gmail.com")) return true;
  if (fullName.includes("tony stark") || fullName.includes("stark") || fullName.includes("rajnandani") || fullName.includes("sinnghaniya")) return true;
  if (fullName.includes("drake farma") || fullName.includes("faaaaaa") || fullName.includes("jimmy jam") || fullName.includes("jimmy has") || fullName.includes("saaf saaf")) return true;
  if (email.includes("drake@gmail.com") || email.includes("faa@gmail.com") || email.includes("jimmy@gmail.com") || email.includes("jimm@gmail.com") || email.includes("saaf@gmail.com") || email.includes("tony@gmail.com") || email.includes("rajnandani@gmail.com")) return true;
  if (serviceName.includes("phase2a") || serviceName.includes("admin test service") || serviceName.includes("1785925484857")) return true;

  // 2. Deleted staff member checks (Thor, Thomas, Girish, etc.)
  let deletedEmails: string[] = [];
  try {
    deletedEmails = JSON.parse(localStorage.getItem("rka_deleted_staff_emails") || "[]");
  } catch (_e) {}

  const deletedSet = new Set(deletedEmails.map((e) => (e || "").toLowerCase()));
  deletedSet.add("thor@gmail.com");
  deletedSet.add("thomas@gmail.com");
  deletedSet.add("injector@gmail.com");
  deletedSet.add("medicaldirector@gmail.com");
  deletedSet.add("securityofficer@gmail.com");

  if (deletedSet.has(staffId) || deletedSet.has(staffName)) return true;

  if (
    staffName.includes("thor") ||
    staffName.includes("thomas") ||
    staffName.includes("girish") ||
    staffId.includes("thor") ||
    staffId.includes("thomas") ||
    staffId.includes("girish")
  ) {
    return true;
  }

  return false;
}

/**
 * Purge test/demo patients and deleted staff appointments from local storage items
 */
export function purgeLocalTestPatients() {
  try {
    const keys = ["rka_demo_appointments", "rka_demo_clinical_notes", "rka_demo_gfe_records", "rka_demo_clients"];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((item: any) => !isTestPatient(item));
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
    }
  } catch (_e) {}
}

try {
  if (typeof window !== "undefined") {
    purgeLocalTestPatients();
  }
} catch (_e) {}
