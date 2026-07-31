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

export async function fetchUnifiedStaffMembers(): Promise<UnifiedStaffMember[]> {
  try {
    const data = await staffService.getStaffProfiles(false);
    if (Array.isArray(data) && data.length > 0) {
      return data.map((s: any) => {
        const roles = s.user?.userRoles?.map((ur: any) => ur.role?.name) || [];
        const primaryRole = roles.find((r: string) => r !== "staff" && r !== "patient") || roles[0] || s.role || "front_desk";
        const rawName = s.fullName || s.full_name || "Staff Member";
        return {
          id: s.id,
          full_name: formatStaffDisplayName(rawName),
          title: s.title || (primaryRole ? primaryRole.replace("_", " ").toUpperCase() : "Staff Provider"),
          email: s.email || s.user?.email || null,
          role: primaryRole,
          is_active: s.isActive !== undefined ? s.isActive : true,
          is_provider: s.isProvider ?? s.is_provider ?? CLINICAL_PROVIDER_ROLES.has(primaryRole),
        };
      });
    }
  } catch (e) {
    console.error("Failed to fetch staff members from DB:", e);
  }

  return [];
}

export async function fetchClinicalProviders(): Promise<UnifiedStaffMember[]> {
  const all = await fetchUnifiedStaffMembers();
  return all.filter(isClinicalProvider);
}
