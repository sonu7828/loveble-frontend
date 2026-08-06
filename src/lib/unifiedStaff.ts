import { staffService } from "@/services/api";

export interface UnifiedStaffMember {
  id: string;
  full_name: string;
  title: string;
  email: string | null;
  role?: string;
  is_active: boolean;
  is_provider?: boolean;
}

const CLINICAL_PROVIDER_ROLES = new Set([
  "medical_director",
  "nurse_practitioner",
  "rn_injector",
  "provider",
]);

export function isClinicalProvider(x: any): boolean {
  if (!x) return false;
  const r = (x.role || "").toLowerCase().trim();
  const t = (x.title || "").toLowerCase().trim();
  const n = (x.full_name || x.fullName || x.name || "").toLowerCase().trim();

  // Explicit exclusion of non-clinical administrative staff & System Admin
  if (
    r === "admin" ||
    r === "system_admin" ||
    r === "scheduler" ||
    r === "front_desk" ||
    r === "privacy_officer" ||
    r === "security_officer"
  ) {
    return false;
  }
  if (
    t.includes("admin") ||
    t.includes("scheduler") ||
    t.includes("receptionist") ||
    t.includes("privacy") ||
    t.includes("security")
  ) {
    return false;
  }
  if (
    n.includes("admin") ||
    n.includes("system admin") ||
    n.includes("scheduler") ||
    n.includes("securityofficer")
  ) {
    return false;
  }

  // Explicit inclusion if is_provider === true or role is in clinical provider set
  if (x.is_provider === true || x.isProvider === true) return true;
  if (CLINICAL_PROVIDER_ROLES.has(r)) return true;
  if (/\b(md|np|rn|injector|director|practitioner|doctor|physician|nurse)\b/i.test(t)) return true;

  return false;
}

export function formatStaffDisplayName(rawName?: string | null): string {
  if (!rawName || !rawName.trim()) return "Staff Member";
  const name = rawName.trim();
  const roleNameMap: Record<string, string> = {
    medicaldirector: "Medical Director",
    nursepractitioner: "Nurse Practitioner",
    nurseprectitioner: "Nurse Practitioner",
    injector: "RN / Injector",
    rninjector: "RN / Injector",
    rn_injector: "RN / Injector",
    provider: "Clinical Provider",
    systemadmin: "System Admin",
    admin: "System Admin",
    scheduler: "Scheduler / Front Desk",
    frontdesk: "Front Desk / Scheduler",
    front_desk: "Front Desk / Scheduler",
    securityofficer: "Privacy & Security Officer",
    privacyofficer: "Privacy & Security Officer",
    privacy_officer: "Privacy & Security Officer",
  };
  const key = name.toLowerCase().replace(/[\s_-]/g, "");
  if (roleNameMap[key]) return roleNameMap[key];
  return name;
}

/** Role → default title mapping for fallback members */
const ROLE_TITLE_MAP: Record<string, string> = {
  medical_director: "Medical Director & Supervising Physician",
  nurse_practitioner: "Nurse Practitioner & Lead Injector",
  rn_injector: "Registered Nurse Injector",
  privacy_officer: "Privacy & Security Officer",
  front_desk: "Front Desk Coordinator & Scheduler",
  admin: "System Administrator",
};

/** Hardcoded fallback clinical providers used when API + localStorage are both empty */
const FALLBACK_PROVIDERS: UnifiedStaffMember[] = [
  {
    id: "staff-md-1",
    full_name: "Dr. Dhruva (MD)",
    title: "Medical Director & Supervising Physician",
    email: "medicaldirector@gmail.com",
    role: "medical_director",
    is_active: true,
    is_provider: true,
  },
  {
    id: "staff-np-1",
    full_name: "Kiem Vukadinovic, NP",
    title: "Nurse Practitioner & Lead Injector",
    email: "nurseprectitioner@gmail.com",
    role: "nurse_practitioner",
    is_active: true,
    is_provider: true,
  },
  {
    id: "staff-rn-1",
    full_name: "Girish, RN Injector",
    title: "Registered Nurse Injector",
    email: "injector@gmail.com",
    role: "rn_injector",
    is_active: true,
    is_provider: true,
  },
];

export async function fetchUnifiedStaffMembers(): Promise<UnifiedStaffMember[]> {
  // ── Step 1: Read rka_approved_staff_accounts from localStorage (always available, set by AdminTeam) ──
  const localStaff: UnifiedStaffMember[] = [];
  const seenEmails = new Set<string>();

  try {
    const approved: any[] = JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
    approved.forEach((a: any) => {
      const emailKey = (a.email || "").toLowerCase();
      if (!emailKey || seenEmails.has(emailKey)) return;
      seenEmails.add(emailKey);
      // Skip admin accounts from provider list
      const role = (a.role || "front_desk").toLowerCase().trim();
      if (role === "admin" || role === "system_admin") return;
      const title = a.title || ROLE_TITLE_MAP[role] || "Team Member";
      localStaff.push({
        id: a.id || `local-${emailKey}`,
        full_name: a.full_name || a.fullName || "Staff Member",
        title,
        email: a.email || null,
        role,
        is_active: true,
        is_provider: CLINICAL_PROVIDER_ROLES.has(role),
      });
    });
  } catch (e) {
    console.error("Failed to load staff from localStorage:", e);
  }

  // ── Step 2: Try API and merge (deduped by email) ──
  try {
    const data = await staffService.getStaffProfiles(false);
    if (Array.isArray(data) && data.length > 0) {
      const apiStaff: UnifiedStaffMember[] = data.map((s: any) => {
        const roles = s.user?.userRoles?.map((ur: any) => ur.role?.name) || [];
        const primaryRole =
          roles.find((r: string) => r !== "staff" && r !== "patient") ||
          roles[0] ||
          s.role ||
          "front_desk";
        const rawName = s.fullName || s.full_name || "Staff Member";
        const emailKey = (s.email || s.user?.email || "").toLowerCase();
        return {
          id: s.id,
          full_name: rawName,
          title:
            s.title ||
            ROLE_TITLE_MAP[primaryRole] ||
            primaryRole.replace(/_/g, " "),
          email: emailKey || null,
          role: primaryRole,
          is_active: s.isActive !== undefined ? s.isActive : true,
          is_provider:
            s.isProvider ??
            s.is_provider ??
            CLINICAL_PROVIDER_ROLES.has(primaryRole),
        };
      });

      // Merge: prefer API data but add any local-only entries not in API
      const apiEmails = new Set(apiStaff.map((s) => (s.email || "").toLowerCase()));
      const localOnly = localStaff.filter(
        (s) => s.email && !apiEmails.has(s.email.toLowerCase())
      );
      const merged = [...apiStaff, ...localOnly].filter(
        (s) => (s.role || "") !== "admin" && (s.role || "") !== "system_admin"
      );
      const seenIds = new Set<string>();
      const deduped = merged.filter((s) => {
        if (!s.id || seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });

      // Ensure at least 1 clinical provider exists for appointment booking
      const hasClinicalProvider = deduped.some(isClinicalProvider);
      if (!hasClinicalProvider) {
        FALLBACK_PROVIDERS.forEach((fp) => {
          if (!seenIds.has(fp.id)) {
            deduped.push(fp);
            seenIds.add(fp.id);
          }
        });
      }

      if (deduped.length > 0) return deduped;
    }
  } catch (e) {
    console.error("Failed to fetch staff members from DB:", e);
  }

  // ── Step 3: Return local staff if API empty or failed ──
  if (localStaff.length > 0) {
    const hasClinicalProvider = localStaff.some(isClinicalProvider);
    if (!hasClinicalProvider) {
      const mergedLocal = [...localStaff];
      FALLBACK_PROVIDERS.forEach((fp) => {
        if (!mergedLocal.some((s) => s.id === fp.id)) {
          mergedLocal.push(fp);
        }
      });
      return mergedLocal;
    }
    return localStaff;
  }

  // ── Step 4: Absolute fallback — hardcoded demo clinical providers ──
  return FALLBACK_PROVIDERS;
}

export async function fetchClinicalProviders(): Promise<UnifiedStaffMember[]> {
  const all = await fetchUnifiedStaffMembers();
  return all.filter(isClinicalProvider);
}
