const DEFAULT_DEMO_NAMES: Record<string, string> = {
  "medicaldirector@gmail.com": "Dr. Dhruva (MD)",
  "nurseprectitioner@gmail.com": "Kiem Vukadinovic, NP",
  "injector@gmail.com": "Girish, RN Injector",
  "securityofficer@gmail.com": "Bob Stane (Security Officer)",
  "scheduler@gmail.com": "Front Desk Coordinator",
  "admin@gmail.com": "Buccky Barnz (Admin)",
};

/**
 * Utility to retrieve the dynamic user profile name configured in My Profile.
 * Ensures user profile name changes instantly update across all portals.
 */
export function getDynamicProfileName(user?: any, fallbackTitle?: string): string {
  try {
    // Remove any legacy un-scoped global profile override
    try { localStorage.removeItem("rka_user_profile_override"); } catch { }

    const email = (typeof user === "string" ? user : user?.email || "").toLowerCase();
    if (email) {
      // 1. Check email-specific profile override saved in My Profile
      const emailOverrideRaw = localStorage.getItem(`rka_user_profile_override_${email}`);
      if (emailOverrideRaw) {
        const parsed = JSON.parse(emailOverrideRaw);
        if (parsed?.full_name && parsed.full_name.trim() && !parsed.full_name.includes("Dr. M")) {
          return parsed.full_name.trim();
        }
      }

      // 2. Check demo profile
      const emailSavedRaw = localStorage.getItem(`rka_demo_profile_${email}`);
      if (emailSavedRaw) {
        const parsed = JSON.parse(emailSavedRaw);
        if (parsed?.form?.full_name && parsed.form.full_name.trim() && !parsed.form.full_name.includes("Dr. M")) {
          return parsed.form.full_name.trim();
        }
      }

      // 3. Check approved staff accounts
      const approvedRaw = localStorage.getItem("rka_approved_staff_accounts");
      if (approvedRaw) {
        const approvedList: any[] = JSON.parse(approvedRaw);
        const match = approvedList.find((a) => a.email && a.email.toLowerCase() === email);
        if (match?.full_name && match.full_name.trim() && !match.full_name.includes("Dr. M")) {
          return match.full_name.trim();
        }
      }

      // 4. Check standard demo defaults
      if (DEFAULT_DEMO_NAMES[email]) {
        return DEFAULT_DEMO_NAMES[email];
      }
    }

    // 5. Check user object properties from auth session
    if (user && typeof user === "object") {
      if (user.first_name || user.last_name) {
        return `${user.first_name || ""} ${user.last_name || ""}`.trim();
      }
      if (user.user_metadata?.full_name) {
        return user.user_metadata.full_name.trim();
      }
    }
  } catch (e) { }

  return fallbackTitle || "Staff Member";
}
