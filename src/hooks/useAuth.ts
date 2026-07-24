import { useEffect, useState } from "react";
import { authService, AppRole, UserProfile } from "@/services/api/authService";

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
  isClinicalStaff: boolean;
  isPrivileged: boolean;
  canSeeAll: boolean;
  canOverride: boolean;
}

export function setDemoAuthSession(email: string, roles: AppRole[], staffId?: string) {
  authService.login(email).then(() => {
    window.dispatchEvent(new Event("rka_demo_auth_change"));
  });
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
      if (session && session.user) {
        setUser(session.user);
        setRoles(session.user.roles || ["admin", "staff"]);
        setStaffId(session.user.staff_id || session.user.id);
      } else {
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
    isClinicalStaff,
    isPrivileged,
    canSeeAll,
    canOverride,
  };
}
