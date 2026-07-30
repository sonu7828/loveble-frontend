import { useEffect, useState } from "react";
import { authService, AppRole, UserProfile, getUserProfileByEmail } from "@/services/api/authService";

export type { AppRole };

export interface AuthState {
  session: any;
  user: UserProfile | null;
  roles: AppRole[];
  staffId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isScheduler: boolean;
  isReceptionist: boolean;
  isStaff: boolean;
  isNP: boolean;
  isMedicalDirector: boolean;
  isPrivacyOfficer: boolean;
  isProvider: boolean;
  isClinicalStaff: boolean;
  isPrivileged: boolean;
  canSeeAll: boolean;
  canOverride: boolean;
}
export function setDemoAuthSession(email: string, roles: AppRole[], staffId?: string) {
  const user = getUserProfileByEmail(email);
  if (roles && roles.length > 0) {
    user.roles = roles;
  }
  sessionStorage.setItem("auth_token", "demo-token");
  sessionStorage.setItem("user_profile", JSON.stringify(user));
  localStorage.setItem("auth_token", "demo-token");
  localStorage.setItem("user_profile", JSON.stringify(user));
  window.dispatchEvent(new Event("rka_demo_auth_change"));
}

export function clearDemoAuthSession() {
  authService.logout();
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserSession() {
      const session = await authService.getSession();
      const BUILTIN_EMAILS = [
        "admin@gmail.com",
        "staff@gmail.com",
        "securityofficer@gmail.com",
        "officer@gmail.com",
        "medicaldirector@gmail.com",
        "md@gmail.com",
        "user@gmail.com",
      ];
      const rawDeleted: string[] = JSON.parse(localStorage.getItem("rka_deleted_staff_emails") || "[]");
      if (rawDeleted.some(e => BUILTIN_EMAILS.includes(e.toLowerCase()))) {
        const sanitized = rawDeleted.filter(e => !BUILTIN_EMAILS.includes(e.toLowerCase()));
        localStorage.setItem("rka_deleted_staff_emails", JSON.stringify(sanitized));
      }
      const deletedEmails: string[] = rawDeleted.filter(e => !BUILTIN_EMAILS.includes(e.toLowerCase()));
      const userEmail = (session?.user?.email || "").toLowerCase();

      if (session && session.user && (!deletedEmails.includes(userEmail) || BUILTIN_EMAILS.includes(userEmail))) {
        setUser(session.user);
        setRoles(session.user.roles || ["admin", "staff"]);
        setStaffId(session.user.staff_id || session.user.id);
      } else {
        if (session && session.user && deletedEmails.includes(userEmail) && !BUILTIN_EMAILS.includes(userEmail)) {
          authService.logout();
        }
        setUser(null);
        setRoles([]);
        setStaffId(null);
      }
      setLoading(false);
    }

    loadUserSession();

    const handleAuthChange = () => {
      loadUserSession();
    };

    window.addEventListener("rka_demo_auth_change", handleAuthChange);
    return () => {
      window.removeEventListener("rka_demo_auth_change", handleAuthChange);
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isScheduler = roles.includes("scheduler") || isAdmin;
  const isReceptionist = roles.includes("receptionist") || isAdmin;
  const isStaff = roles.includes("staff") || isAdmin;
  const isNP = roles.includes("nurse_practitioner") || isAdmin;
  const isMedicalDirector = roles.includes("medical_director");
  const isPrivacyOfficer = roles.includes("privacy_officer");
  const isProvider = (roles.includes("nurse_practitioner") || roles.includes("provider") || (roles.includes("staff") && !isAdmin)) && !isMedicalDirector && !isPrivacyOfficer && !isAdmin;
  const isClinicalStaff = isAdmin || isStaff || isScheduler || isNP || isMedicalDirector;
  const isPrivileged = isAdmin || isStaff || isNP || isMedicalDirector || isPrivacyOfficer;
  const canOverride = isAdmin || isScheduler || isReceptionist || isNP || isMedicalDirector;
  const canSeeAll = canOverride || isNP || isMedicalDirector;

  return {
    session: user ? { user } : null,
    user,
    roles,
    staffId,
    loading,
    isAdmin,
    isScheduler,
    isReceptionist,
    isStaff,
    isNP,
    isMedicalDirector,
    isPrivacyOfficer,
    isProvider,
    isClinicalStaff,
    isPrivileged,
    canSeeAll,
    canOverride,
  };
}
