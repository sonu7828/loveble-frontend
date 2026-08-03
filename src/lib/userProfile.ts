/**
 * Utility to retrieve the dynamic user profile name configured in My Profile.
 * Ensures user profile name changes instantly update across all portals.
 */
export function getDynamicProfileName(user?: any, fallbackTitle?: string): string {
  try {
    // 1. Check global profile override saved when user clicks "Save changes" in My Profile
    const globalOverrideRaw = localStorage.getItem("rka_user_profile_override");
    if (globalOverrideRaw) {
      const parsed = JSON.parse(globalOverrideRaw);
      if (parsed?.full_name && parsed.full_name.trim()) {
        return parsed.full_name.trim();
      }
    }

    // 2. Check active user session demo profile
    const demoUserRaw = localStorage.getItem("rka_demo_user");
    if (demoUserRaw) {
      const parsed = JSON.parse(demoUserRaw);
      if (parsed?.full_name && parsed.full_name.trim()) {
        return parsed.full_name.trim();
      }
      if (parsed?.first_name || parsed?.last_name) {
        return `${parsed.first_name || ""} ${parsed.last_name || ""}`.trim();
      }
    }

    // 3. Check email-specific profile override
    const email = (user?.email || "").toLowerCase();
    if (email) {
      const emailSavedRaw = localStorage.getItem(`rka_demo_profile_${email}`);
      if (emailSavedRaw) {
        const parsed = JSON.parse(emailSavedRaw);
        if (parsed?.form?.full_name && parsed.form.full_name.trim()) {
          return parsed.form.full_name.trim();
        }
      }

      // Check approved staff accounts
      const approvedRaw = localStorage.getItem("rka_approved_staff_accounts");
      if (approvedRaw) {
        const approvedList: any[] = JSON.parse(approvedRaw);
        const match = approvedList.find((a) => a.email && a.email.toLowerCase() === email);
        if (match?.full_name && match.full_name.trim()) {
          return match.full_name.trim();
        }
      }
    }

    // 4. Check user object properties from auth session
    if (user?.first_name || user?.last_name) {
      return `${user.first_name || ""} ${user.last_name || ""}`.trim();
    }
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.trim();
    }
  } catch (e) {}

  return fallbackTitle || "Staff Member";
}
