import { staffService } from "@/services/api";

export interface UnifiedStaffMember {
  id: string;
  full_name: string;
  title: string;
  email: string | null;
  role?: string;
  is_active: boolean;
}

export async function fetchUnifiedStaffMembers(): Promise<UnifiedStaffMember[]> {
  try {
    const data = await staffService.getStaffProfiles(false);
    if (Array.isArray(data) && data.length > 0) {
      return data.map((s: any) => {
        const roles = s.user?.userRoles?.map((ur: any) => ur.role?.name) || [];
        const primaryRole = roles.find((r: string) => r !== "staff") || roles[0] || s.role || "staff";
        return {
          id: s.id,
          full_name: s.fullName || s.full_name || "Staff Member",
          title: s.title || (primaryRole ? primaryRole.replace("_", " ").toUpperCase() : "Staff Provider"),
          email: s.email || s.user?.email || null,
          role: primaryRole,
          is_active: s.isActive !== undefined ? s.isActive : true,
        };
      });
    }
  } catch (e) {
    console.error("Failed to fetch staff members from DB:", e);
  }

  return [];
}
