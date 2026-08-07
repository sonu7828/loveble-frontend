const DEFAULT_DEMO_NAMES: Record<string, string> = {
  "medicaldirector@gmail.com": "Dr. Dhruva (MD)",
  "nurseprectitioner@gmail.com": "Kiem Vukadinovic, NP",
  "injector@gmail.com": "Girish, RN Injector",
  "securityofficer@gmail.com": "Bob Stane (Security Officer)",
  "scheduler@gmail.com": "Front Desk Coordinator",
  "admin@gmail.com": "ADMIN",
};

/**
 * Utility to retrieve the dynamic user profile name configured in My Profile.
 * Ensures user profile name changes instantly update across all portals.
 */
export function getDynamicProfileName(user?: any, fallbackTitle?: string): string {
  try {
    // 1. Prioritize real database user object properties from API/DB first
    if (user && typeof user === "object") {
      const realName = (user.full_name || user.fullName || user.name || "").trim();
      if (realName && realName !== "Medical Director" && realName !== "Staff Member" && realName !== "Privacy & Security Officer") {
        return realName;
      }
      if (user.first_name || user.last_name) {
        const combined = `${user.first_name || ""} ${user.last_name || ""}`.trim();
        if (combined) return combined;
      }
      if (user.user_metadata?.full_name) {
        return user.user_metadata.full_name.trim();
      }
    }

    const email = (typeof user === "string" ? user : user?.email || "").toLowerCase().trim();
    if (email) {
      // 2. Check approved staff accounts
      const approvedRaw = localStorage.getItem("rka_approved_staff_accounts");
      if (approvedRaw) {
        const approvedList: any[] = JSON.parse(approvedRaw);
        const match = approvedList.find((a) => a.email && a.email.toLowerCase() === email);
        if (match?.full_name && match.full_name.trim() && !match.full_name.includes("Dr. M")) {
          return match.full_name.trim();
        }
      }

      // 3. Check email-specific profile override saved in My Profile
      const emailOverrideRaw = localStorage.getItem(`rka_user_profile_override_${email}`);
      if (emailOverrideRaw) {
        const parsed = JSON.parse(emailOverrideRaw);
        if (parsed?.full_name && parsed.full_name.trim() && !parsed.full_name.includes("Dr. M")) {
          return parsed.full_name.trim();
        }
      }

      // 4. Fallback default if email is admin@gmail.com
      if (email === "admin@gmail.com" || email === "phase1-admin@radiantilyk.com") {
        return "ADMIN";
      }
    }
  } catch (e) { }

  return fallbackTitle || "Staff Member";
}
